-- Pagamento online do agendamento.
--
-- Desenho pensado para trocar de provedor sem refazer nada. O Mercado Pago e o
-- primeiro, mas nada nesta tabela e proprio dele: `provedor` diz quem processou,
-- `referenciaExterna` guarda o identificador la do outro lado, e `bruto` guarda
-- a resposta inteira. Quando entrar um segundo provedor, muda a funcao de borda
-- e o resto continua igual.
--
-- O que NAO esta aqui, de proposito: nenhuma chave, nenhum dado de cartao. A
-- cobranca acontece no ambiente do provedor; o sistema so guarda o numero do
-- pedido e o desfecho. Guardar cartao exigiria certificacao que uma oficina nao
-- tem e nao precisa ter.

-- ------------------------------------------------------------
-- Regras da cobranca no agendamento
-- ------------------------------------------------------------
create table if not exists public.parametros_agenda (
  id                text primary key default 'default',
  "exigePagamento"  boolean not null default false,
  "tipoCobranca"    text not null default 'SINAL'
                      check ("tipoCobranca" in ('SINAL','TOTAL')),
  "sinalPct"        numeric(5,2) not null default 30.00
                      check ("sinalPct" > 0 and "sinalPct" <= 100),
  -- Dinheiro em caixa e o filtro mais forte contra trote e falta. Quando o
  -- pagamento entra, faz pouco sentido o horario seguir pendente esperando
  -- alguem clicar em confirmar.
  "confirmarAoPagar" boolean not null default true,
  provedor          text not null default 'MERCADO_PAGO',
  -- Minutos que o horario fica preso esperando o pagamento. Passado o prazo,
  -- ele volta para a agenda: sem isso, cada checkout abandonado deixaria um
  -- buraco morto no dia.
  "minutosReserva"  int not null default 30 check ("minutosReserva" between 5 and 240),
  "atualizadoEm"    timestamptz not null default now(),
  constraint parametros_agenda_unico check (id = 'default')
);

insert into public.parametros_agenda (id) values ('default') on conflict do nothing;

-- ------------------------------------------------------------
-- Cobrancas
-- ------------------------------------------------------------
create table if not exists public.pagamentos_online (
  id                  text primary key,
  "agendamentoId"     text references public.agendamentos (id) on delete cascade,
  "ordemId"           text references public.ordens_servico (id) on delete set null,
  provedor            text not null default 'MERCADO_PAGO',
  -- Identificador do pedido no provedor. Unico para o webhook nunca processar
  -- a mesma notificacao duas vezes — eles reenviam quando nao recebem resposta.
  "referenciaExterna" text,
  status              text not null default 'CRIADO'
                        check (status in ('CRIADO','PENDENTE','PAGO','RECUSADO',
                                          'ESTORNADO','EXPIRADO','CANCELADO')),
  valor               numeric(10,2) not null check (valor > 0),
  "urlPagamento"      text,
  -- Resposta completa do provedor. Quando o cliente disser que pagou e o
  -- sistema disser que nao, e isto que resolve a discussao.
  bruto               jsonb,
  "expiraEm"          timestamptz,
  "pagoEm"            timestamptz,
  "criadoEm"          timestamptz not null default now(),
  "atualizadoEm"      timestamptz not null default now()
);

create unique index if not exists pag_online_ref_uk
  on public.pagamentos_online (provedor, "referenciaExterna")
  where "referenciaExterna" is not null;
create index if not exists pag_online_agendamento_idx
  on public.pagamentos_online ("agendamentoId");
create index if not exists pag_online_status_idx on public.pagamentos_online (status);

comment on table public.pagamentos_online is
  'Cobrancas feitas fora do sistema, no ambiente do provedor. Nao guarda dado de '
  'cartao: so o numero do pedido e o desfecho.';

-- O agendamento passa a saber se esta pago.
alter table public.agendamentos
  add column if not exists "pagamentoId" text
    references public.pagamentos_online (id) on delete set null,
  add column if not exists "valorCobrado" numeric(10,2),
  add column if not exists "reservadoAte" timestamptz;

comment on column public.agendamentos."reservadoAte" is
  'Ate quando o horario fica preso esperando o pagamento. Depois disso volta '
  'para a agenda, para checkout abandonado nao deixar buraco morto no dia.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.parametros_agenda  enable row level security;
alter table public.pagamentos_online  enable row level security;
revoke all on public.parametros_agenda from anon;
revoke all on public.pagamentos_online from anon;

drop policy if exists param_agenda_ler on public.parametros_agenda;
create policy param_agenda_ler on public.parametros_agenda
  for select to authenticated using (public.eh_equipe());
drop policy if exists param_agenda_escrever on public.parametros_agenda;
create policy param_agenda_escrever on public.parametros_agenda
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

drop policy if exists pag_online_ler on public.pagamentos_online;
create policy pag_online_ler on public.pagamentos_online
  for select to authenticated using (public.eh_equipe());
-- Escrita so pela funcao de borda, que usa a chave de servico e ignora a RLS.
-- Ninguem marca um pagamento como PAGO pela tela.
drop policy if exists pag_online_escrever on public.pagamentos_online;
create policy pag_online_escrever on public.pagamentos_online
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- ------------------------------------------------------------
-- Registrar o desfecho de uma cobranca
-- ------------------------------------------------------------
-- Chamada pela funcao de borda depois que o provedor avisa. Concentra aqui o
-- que acontece ao pagar — confirmar o horario, soltar a reserva, avisar a loja —
-- para a funcao de borda so traduzir o formato do provedor.
create or replace function public.registrar_desfecho_pagamento(
  p_referencia text,
  p_provedor   text,
  p_status     text,
  p_bruto      jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pag   public.pagamentos_online%rowtype;
  v_ag    public.agendamentos%rowtype;
  v_par   public.parametros_agenda%rowtype;
  v_fuso  text := public.fuso_empresa();
begin
  select * into v_pag from public.pagamentos_online
  where provedor = p_provedor and "referenciaExterna" = p_referencia
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'cobranca nao encontrada');
  end if;

  -- O provedor reenvia a notificacao ate receber confirmacao. Sem esta saida,
  -- a mesma cobranca confirmaria o agendamento varias vezes e geraria alertas
  -- repetidos.
  if v_pag.status = p_status then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;

  update public.pagamentos_online
  set status = p_status,
      bruto = coalesce(p_bruto, bruto),
      "pagoEm" = case when p_status = 'PAGO' then now() else "pagoEm" end,
      "atualizadoEm" = now()
  where id = v_pag.id;

  if v_pag."agendamentoId" is null then
    return jsonb_build_object('ok', true, 'agendamento', null);
  end if;

  select * into v_ag from public.agendamentos where id = v_pag."agendamentoId" for update;
  select * into v_par from public.parametros_agenda where id = 'default';

  if p_status = 'PAGO' then
    update public.agendamentos
    set status = case when v_par."confirmarAoPagar" and status = 'PENDENTE'
                   then 'CONFIRMADO' else status end,
        "confirmadoEm" = case when v_par."confirmarAoPagar" and status = 'PENDENTE'
                           then now() else "confirmadoEm" end,
        -- Pago deixa de ter prazo para expirar.
        "reservadoAte" = null,
        "atualizadoEm" = now()
    where id = v_ag.id;

    insert into public.alertas
      (id, tipo, status, titulo, descricao, "dataAlvo", "criadoEm")
    values
      (gen_random_uuid()::text, 'FINANCEIRO_VENCIMENTO', 'PENDENTE',
       'Pagamento recebido — agendamento #' || v_ag.numero,
       v_ag.nome || ' pagou ' || to_char(v_pag.valor, 'FM999G999G990D00')
         || ' para ' || to_char(v_ag.inicio at time zone v_fuso, 'DD/MM HH24:MI') || '.',
       now(), now());

  elsif p_status in ('RECUSADO','EXPIRADO','CANCELADO') then
    -- Pagamento que nao veio solta o horario: o agendamento so existia por
    -- causa dele.
    update public.agendamentos
    set status = 'CANCELADO',
        "canceladoEm" = now(),
        "motivoCancelamento" = 'Pagamento nao concluido (' || p_status || ')',
        "atualizadoEm" = now()
    where id = v_ag.id and status = 'PENDENTE';
  end if;

  return jsonb_build_object('ok', true, 'agendamento', v_ag.numero, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- Soltar horarios cuja reserva venceu
-- ------------------------------------------------------------
create or replace function public.liberar_reservas_vencidas()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_soltos int;
begin
  update public.agendamentos
  set status = 'CANCELADO',
      "canceladoEm" = now(),
      "motivoCancelamento" = 'Pagamento nao concluido no prazo',
      "atualizadoEm" = now()
  where status = 'PENDENTE'
    and "reservadoAte" is not null
    and "reservadoAte" < now();
  get diagnostics v_soltos = row_count;
  return v_soltos;
end;
$$;

revoke all on function public.registrar_desfecho_pagamento(text, text, text, jsonb) from public, anon;
revoke all on function public.liberar_reservas_vencidas() from public, anon;
grant execute on function public.liberar_reservas_vencidas() to authenticated;
