-- Programa de fidelidade.
--
-- Decisao central: o ponto e creditado quando o dinheiro ENTRA, nao quando o
-- carro sai. Creditar na entrega premiaria quem levou o veiculo e nao pagou —
-- e, pior, obrigaria a estornar ponto se a conta virasse calote. Amarrado ao
-- recebimento, o saldo sempre corresponde a dinheiro que existiu.
--
-- Por isso o credito nasce de um gatilho no `lancamentos`, e nao de uma chamada
-- na entrega: assim vale para qualquer caminho que quite a conta — a entrega
-- paga no ato, o sinal, a baixa manual de uma parcela no financeiro.
--
-- O saldo nao e uma coluna somada a mao. E um extrato: cada ganho e cada
-- resgate viram linha. Saldo que se guarda em coluna sempre acaba divergindo do
-- historico, e ninguem consegue explicar ao cliente de onde saiu o numero.

-- ------------------------------------------------------------
-- Regras do programa
-- ------------------------------------------------------------
create table if not exists public.parametros_fidelidade (
  id                text primary key default 'default',
  ativo             boolean not null default true,
  "pontosPorReal"   numeric(6,2) not null default 1.00,
  -- Quanto vale um ponto no resgate. 0,05 = cada 100 pontos viram R$ 5,00.
  "valorDoPonto"    numeric(6,4) not null default 0.0500,
  "validadeMeses"   int not null default 12,
  "minimoResgate"   int not null default 200,
  "atualizadoEm"    timestamptz not null default now(),
  constraint parametros_fidelidade_unico check (id = 'default')
);

insert into public.parametros_fidelidade (id) values ('default') on conflict do nothing;

-- ------------------------------------------------------------
-- Extrato de pontos
-- ------------------------------------------------------------
create table if not exists public.fidelidade_movimentos (
  id           text primary key,
  "clienteId"  text not null references public.clientes (id) on delete cascade,
  "ordemId"    text references public.ordens_servico (id) on delete set null,
  tipo         text not null check (tipo in ('GANHO','RESGATE','EXPIRACAO','AJUSTE')),
  -- Positivo credita, negativo debita. Um campo so evita a duvida de qual
  -- coluna somar na hora de fechar o saldo.
  pontos       int not null,
  "valorBase"  numeric(10,2),
  descricao    text,
  "expiraEm"   timestamptz,
  "criadoEm"   timestamptz not null default now()
);

create index if not exists fid_mov_cliente_idx on public.fidelidade_movimentos ("clienteId");
create index if not exists fid_mov_ordem_idx   on public.fidelidade_movimentos ("ordemId");

comment on table public.fidelidade_movimentos is
  'Extrato de pontos. O saldo e a soma desta tabela, nunca uma coluna avulsa.';

-- Liga o credito ao lancamento que o gerou: evita creditar duas vezes a mesma
-- baixa quando alguem reabre e fecha o lancamento de novo.
alter table public.fidelidade_movimentos
  add column if not exists "lancamentoId" text
    references public.lancamentos (id) on delete set null;
-- Indice SEM predicado de proposito. Com `where "lancamentoId" is not null` ele
-- vira parcial, e ai o `on conflict ("lancamentoId")` do gatilho nao consegue
-- inferi-lo — o erro derruba a insercao do pagamento inteiro. O Postgres ja
-- trata NULLs como distintos num unique, entao os resgates (que nao tem
-- lancamento) convivem sem conflito.
drop index if exists fid_mov_lancamento_uk;
create unique index if not exists fid_mov_lancamento_uk
  on public.fidelidade_movimentos ("lancamentoId");

-- ------------------------------------------------------------
-- Saldo e nivel por cliente
-- ------------------------------------------------------------
create or replace view public.fidelidade_saldo
with (security_invoker = true) as
select
  c.id                                as "clienteId",
  c.nome,
  coalesce(m.pontos, 0)               as pontos,
  coalesce(g.gasto12m, 0)             as "gasto12m",
  coalesce(g.visitas12m, 0)           as "visitas12m",
  case
    when coalesce(g.gasto12m, 0) >= 15000 then 'DIAMANTE'
    when coalesce(g.gasto12m, 0) >= 5000  then 'OURO'
    when coalesce(g.gasto12m, 0) >= 1500  then 'PRATA'
    else 'BRONZE'
  end                                 as nivel
from public.clientes c
left join lateral (
  select sum(pontos) pontos
  from public.fidelidade_movimentos
  where "clienteId" = c.id
    -- Ponto vencido nao conta no saldo, mas continua no extrato.
    and ("expiraEm" is null or "expiraEm" > now())
) m on true
left join lateral (
  -- O nivel olha os ultimos doze meses: cliente fiel e quem volta, nao quem
  -- gastou muito uma vez em 2019.
  select sum(l.valor) gasto12m, count(distinct l."ordemId") visitas12m
  from public.lancamentos l
  join public.ordens_servico o on o.id = l."ordemId"
  where o."clienteId" = c.id and l.tipo = 'RECEITA' and l.status = 'PAGO'
    and l.pagamento > now() - interval '12 months'
) g on true;

comment on view public.fidelidade_saldo is
  'Saldo de pontos e nivel do cliente. O nivel vem do gasto dos ultimos 12 meses.';

-- ------------------------------------------------------------
-- Credito automatico quando o recebimento e quitado
-- ------------------------------------------------------------
create or replace function public.creditar_pontos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par     public.parametros_fidelidade%rowtype;
  v_cliente text;
  v_numero  int;
  v_pontos  int;
begin
  -- So interessa a transicao para PAGO de uma receita ligada a uma OS.
  if new.tipo <> 'RECEITA' or new.status <> 'PAGO' or new."ordemId" is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'PAGO' then
    return new;
  end if;

  select * into v_par from public.parametros_fidelidade where id = 'default';
  if not found or not v_par.ativo or v_par."pontosPorReal" <= 0 then
    return new;
  end if;

  select o."clienteId", o.numero into v_cliente, v_numero
  from public.ordens_servico o where o.id = new."ordemId";
  if v_cliente is null then
    return new;
  end if;

  v_pontos := floor(new.valor * v_par."pontosPorReal");
  if v_pontos <= 0 then
    return new;
  end if;

  -- `on conflict do nothing` cobre a baixa refeita: o indice unico por
  -- lancamento garante um credito so, mesmo que o status va e volte.
  insert into public.fidelidade_movimentos
    (id, "clienteId", "ordemId", "lancamentoId", tipo, pontos, "valorBase",
     descricao, "expiraEm", "criadoEm")
  values
    (gen_random_uuid()::text, v_cliente, new."ordemId", new.id, 'GANHO',
     v_pontos, new.valor,
     'Pagamento da OS ' || coalesce(v_numero::text, '?'),
     now() + make_interval(months => greatest(v_par."validadeMeses", 1)), now())
  on conflict ("lancamentoId") do nothing;

  return new;
end;
$$;

drop trigger if exists ao_quitar_recebimento on public.lancamentos;
create trigger ao_quitar_recebimento
  after insert or update of status on public.lancamentos
  for each row execute function public.creditar_pontos();

-- ------------------------------------------------------------
-- Resgate
-- ------------------------------------------------------------
create or replace function public.resgatar_pontos(
  p_cliente_id text,
  p_pontos     int,
  p_ordem_id   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par   public.parametros_fidelidade%rowtype;
  v_saldo int;
  v_valor numeric(10,2);
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_par from public.parametros_fidelidade where id = 'default';
  if not v_par.ativo then
    raise exception 'o programa de fidelidade esta desativado' using errcode = 'P0001';
  end if;
  if p_pontos <= 0 then
    raise exception 'informe quantos pontos resgatar' using errcode = 'P0001';
  end if;
  if p_pontos < v_par."minimoResgate" then
    raise exception 'o resgate minimo e de % pontos', v_par."minimoResgate"
      using errcode = 'P0001';
  end if;

  select coalesce(sum(pontos), 0) into v_saldo
  from public.fidelidade_movimentos
  where "clienteId" = p_cliente_id and ("expiraEm" is null or "expiraEm" > now());

  if p_pontos > v_saldo then
    raise exception 'saldo insuficiente: o cliente tem % ponto(s)', v_saldo
      using errcode = 'P0001';
  end if;

  v_valor := round(p_pontos * v_par."valorDoPonto", 2);

  insert into public.fidelidade_movimentos
    (id, "clienteId", "ordemId", tipo, pontos, "valorBase", descricao, "criadoEm")
  values
    (gen_random_uuid()::text, p_cliente_id, p_ordem_id, 'RESGATE',
     -p_pontos, v_valor,
     'Resgate de ' || p_pontos || ' pontos como desconto', now());

  return jsonb_build_object(
    'pontos', p_pontos,
    'valor', v_valor,
    'saldo_restante', v_saldo - p_pontos
  );
end;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.parametros_fidelidade   enable row level security;
alter table public.fidelidade_movimentos   enable row level security;
revoke all on public.parametros_fidelidade from anon;
revoke all on public.fidelidade_movimentos from anon;

drop policy if exists param_fid_ler on public.parametros_fidelidade;
create policy param_fid_ler on public.parametros_fidelidade
  for select to authenticated using (public.eh_equipe());
drop policy if exists param_fid_escrever on public.parametros_fidelidade;
create policy param_fid_escrever on public.parametros_fidelidade
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists fid_mov_ler on public.fidelidade_movimentos;
create policy fid_mov_ler on public.fidelidade_movimentos
  for select to authenticated using (public.eh_equipe());
-- Escrita so pelo gatilho e pela funcao de resgate, que sao SECURITY DEFINER:
-- ninguem credita ponto para si mesmo inserindo uma linha na mao.
drop policy if exists fid_mov_escrever on public.fidelidade_movimentos;
create policy fid_mov_escrever on public.fidelidade_movimentos
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

grant select on public.fidelidade_saldo to authenticated;
revoke all on public.fidelidade_saldo from anon;

revoke all on function public.resgatar_pontos(text, int, text) from public, anon;
grant execute on function public.resgatar_pontos(text, int, text) to authenticated;
