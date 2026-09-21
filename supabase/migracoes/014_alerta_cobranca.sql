-- Alerta de cobranca.
--
-- A conta vencida ja virava ATRASADO e entrava no total "a receber", mas nada
-- avisava ninguem: o dinheiro so aparecia como problema quando alguem abria o
-- financeiro e reparava no numero. Cobranca esquecida vira calote por inercia.
--
-- Um alerta por OS, nao por parcela: quem tem tres parcelas vencidas do mesmo
-- cliente precisa de UM telefonema, nao de tres avisos iguais na lista.

create or replace function public.sincronizar_pendencias()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expirados int;
  v_atrasados int;
  v_novos     int := 0;
  v_cobranca  int := 0;
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  update public.orcamentos set status = 'EXPIRADO'
  where status in ('RASCUNHO','ENVIADO') and "validoAte" < now();
  get diagnostics v_expirados = row_count;

  update public.lancamentos set status = 'ATRASADO'
  where status = 'PENDENTE' and vencimento < now();
  get diagnostics v_atrasados = row_count;

  -- --- entrega atrasada ---
  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId", "ordemId", "criadoEm")
  select gen_random_uuid()::text, 'ENTREGA_ATRASADA', 'PENDENTE',
         'OS ' || o.numero || ' atrasada: ' || c.nome,
         v.marca || ' ' || v.modelo || ' (' || v.placa || ') passou da previsao de entrega.',
         o."previsaoEntrega", o."clienteId", o."veiculoId", o.id, now()
  from public.ordens_servico o
  join public.clientes c on c.id = o."clienteId"
  join public.veiculos v on v.id = o."veiculoId"
  where o.status in ('AGUARDANDO','EM_ANDAMENTO','PAUSADA')
    and o."previsaoEntrega" < now()
    and not exists (
      select 1 from public.alertas a
      where a."ordemId" = o.id and a.tipo = 'ENTREGA_ATRASADA' and a.status = 'PENDENTE');
  get diagnostics v_novos = row_count;

  -- --- cobranca vencida ---
  -- Um dia de carencia: conta que venceu hoje de manha ainda pode ser paga hoje
  -- a tarde, e ninguem quer ligar para o cliente cobrando algo do mesmo dia.
  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId", "ordemId", "criadoEm")
  select gen_random_uuid()::text, 'FINANCEIRO_VENCIMENTO', 'PENDENTE',
         'Cobrar ' || c.nome || ' — OS ' || o.numero,
         -- Os separadores de `to_char` seguem a configuracao regional do banco,
         -- que aqui nao e a brasileira: sai "1234.56". A troca manual garante
         -- "R$ 1.234,56" independentemente de onde o banco esteja hospedado.
         'Em aberto ha ' || (now()::date - min(l.vencimento)::date) || ' dia(s): R$ '
           || translate(to_char(sum(l.valor), 'FM999,999,990.00'), ',.', '.,')
           || ' em ' || count(*) || ' parcela(s) vencida(s).',
         now(), o."clienteId", o."veiculoId", o.id, now()
  from public.lancamentos l
  join public.ordens_servico o on o.id = l."ordemId"
  join public.clientes c on c.id = o."clienteId"
  where l.tipo = 'RECEITA'
    and l.status in ('PENDENTE','ATRASADO')
    and l.vencimento < now() - interval '1 day'
    and not exists (
      select 1 from public.alertas a
      where a."ordemId" = o.id and a.tipo = 'FINANCEIRO_VENCIMENTO'
        and a.status = 'PENDENTE')
  group by o.id, o.numero, o."clienteId", o."veiculoId", c.nome;
  get diagnostics v_cobranca = row_count;

  -- Quem pagou nao deve continuar na lista de cobranca. Sem isto o alerta ficaria
  -- pendente para sempre e alguem ligaria para um cliente ja quitado.
  update public.alertas a
  set status = 'CONCLUIDO', "concluidoEm" = now(), resultado = 'Quitado.'
  where a.tipo = 'FINANCEIRO_VENCIMENTO'
    and a.status = 'PENDENTE'
    and a."ordemId" is not null
    and not exists (
      select 1 from public.lancamentos l
      where l."ordemId" = a."ordemId" and l.tipo = 'RECEITA'
        and l.status in ('PENDENTE','ATRASADO'));

  return jsonb_build_object(
    'orcamentos_expirados', v_expirados,
    'lancamentos_atrasados', v_atrasados,
    'alertas_criados', v_novos,
    'alertas_cobranca', v_cobranca
  );
end;
$$;

revoke all on function public.sincronizar_pendencias from public, anon;
grant execute on function public.sincronizar_pendencias to authenticated;
