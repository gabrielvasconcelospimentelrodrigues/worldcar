-- ============================================================
-- World Car Service — 004: fornecedores e cotação de compras
--
-- Fecha o ciclo: a oficina precisa de uma peça (às vezes para uma OS
-- específica), pede preço a vários fornecedores, compara lado a lado e decide.
-- A decisão pode virar despesa no financeiro.
-- ============================================================

create type public."TipoFornecedor" as enum (
  'PECAS', 'TINTAS', 'INSUMOS', 'PELICULAS', 'FERRAMENTAS', 'SERVICO_TERCEIRIZADO', 'OUTROS'
);

create type public."StatusCotacao" as enum (
  'ABERTA',      -- montada, aguardando os fornecedores responderem
  'RESPONDIDA',  -- ao menos um fornecedor respondeu
  'DECIDIDA',    -- vencedor escolhido
  'CANCELADA'
);

-- ------------------------------------------------------------
-- Fornecedores
-- ------------------------------------------------------------
create table public.fornecedores (
  id                    text primary key,
  nome                  text not null,
  "razaoSocial"         text,
  documento             text unique,               -- CNPJ ou CPF
  tipo                  public."TipoFornecedor" not null default 'PECAS',
  contato               text,                      -- nome do vendedor
  telefone              text,
  "telefone2"           text,
  email                 text,
  cep                   text,
  endereco              text,
  numero                text,
  bairro                text,
  cidade                text,
  uf                    text,
  "prazoEntregaDias"    int,
  "condicoesPagamento"  text,
  observacoes           text,
  ativo                 boolean not null default true,
  "criadoEm"            timestamptz not null default now(),
  "atualizadoEm"        timestamptz not null default now()
);

create index fornecedores_nome_idx on public.fornecedores (nome);
create index fornecedores_ativo_idx on public.fornecedores (ativo);

comment on table public.fornecedores is
  'Fornecedores de peças, tintas, insumos e serviços terceirizados.';

-- ------------------------------------------------------------
-- Cotação
-- ------------------------------------------------------------
create sequence public.cotacoes_numero_seq;

create table public.cotacoes (
  id             text primary key,
  numero         int not null default nextval('public.cotacoes_numero_seq') unique,
  status         public."StatusCotacao" not null default 'ABERTA',
  descricao      text not null,
  -- Peça para um veículo específico: a cotação nasce de uma OS
  "ordemId"      text references public.ordens_servico (id) on delete set null,
  "solicitanteId" text references public."funcionarios" (id) on delete set null,
  "prazoResposta" timestamptz,
  observacoes    text,
  "decididaEm"   timestamptz,
  "motivoDecisao" text,   -- por que o vencedor não foi o mais barato, quando for o caso
  "criadoEm"     timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

create index cotacoes_status_idx on public.cotacoes (status);
create index cotacoes_ordem_idx on public.cotacoes ("ordemId");

-- O que está sendo cotado
create table public.cotacao_itens (
  id          text primary key,
  "cotacaoId" text not null references public.cotacoes (id) on delete cascade,
  descricao   text not null,
  quantidade  numeric(10,2) not null default 1,
  unidade     text not null default 'un',
  observacoes text,
  ordem       int not null default 0
);

create index cotacao_itens_cotacao_idx on public.cotacao_itens ("cotacaoId");

-- Quem foi consultado, e em que condições respondeu
create table public.cotacao_fornecedores (
  id                   text primary key,
  "cotacaoId"          text not null references public.cotacoes (id) on delete cascade,
  "fornecedorId"       text not null references public.fornecedores (id) on delete cascade,
  "respondidoEm"       timestamptz,
  "prazoEntregaDias"   int,
  "condicoesPagamento" text,
  frete                numeric(10,2) not null default 0,
  desconto             numeric(10,2) not null default 0,
  observacoes          text,
  vencedor             boolean not null default false,
  unique ("cotacaoId", "fornecedorId")
);

create index cotacao_fornecedores_cotacao_idx on public.cotacao_fornecedores ("cotacaoId");

-- O preço de cada fornecedor para cada item — a matriz da comparação
create table public.cotacao_precos (
  id                     text primary key,
  "cotacaoItemId"        text not null references public.cotacao_itens (id) on delete cascade,
  "cotacaoFornecedorId"  text not null references public.cotacao_fornecedores (id) on delete cascade,
  "precoUnit"            numeric(10,2) not null default 0,
  disponivel             boolean not null default true,
  "prazoDias"            int,
  marca                  text,   -- original, paralela, qual fabricante
  observacao             text,
  vencedor               boolean not null default false,  -- escolhido item a item
  unique ("cotacaoItemId", "cotacaoFornecedorId")
);

create index cotacao_precos_item_idx on public.cotacao_precos ("cotacaoItemId");
create index cotacao_precos_fornecedor_idx on public.cotacao_precos ("cotacaoFornecedorId");

comment on table public.cotacao_precos is
  'Matriz item x fornecedor. `vencedor` marca a escolha item a item; o vencedor '
  'geral da cotação fica em cotacao_fornecedores.vencedor.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','cotacoes','cotacao_itens','cotacao_fornecedores','cotacao_precos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('grant all on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

grant usage, select on sequence public.cotacoes_numero_seq to authenticated;

-- Compras é assunto de gestão: preço de custo revela margem.
-- O técnico não alcança nada disso.
create policy fornecedores_gestao on public.fornecedores
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

create policy cotacoes_gestao on public.cotacoes
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

create policy cotacao_itens_gestao on public.cotacao_itens
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

create policy cotacao_fornecedores_gestao on public.cotacao_fornecedores
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

create policy cotacao_precos_gestao on public.cotacao_precos
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

-- ------------------------------------------------------------
-- Decidir a cotação
--
-- Marca o vencedor, fecha a cotação e — se pedido — lança a despesa no
-- financeiro. Fica no banco pela mesma razão das outras: é dinheiro, e no
-- navegador seria manipulável.
-- ------------------------------------------------------------
create or replace function public.decidir_cotacao(
  p_cotacao_id     text,
  p_fornecedor_id  text,          -- cotacao_fornecedores.id do vencedor geral
  p_motivo         text default null,
  p_gerar_despesa  boolean default false,
  p_vencimento     timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cot        public.cotacoes%rowtype;
  v_forn       public.cotacao_fornecedores%rowtype;
  v_nome       text;
  v_total      numeric(10,2);
  v_categoria  text;
  v_lancamento text;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_cot from public.cotacoes where id = p_cotacao_id for update;
  if not found then
    raise exception 'cotacao nao encontrada' using errcode = 'P0002';
  end if;
  if v_cot.status = 'CANCELADA' then
    raise exception 'esta cotacao foi cancelada' using errcode = 'P0001';
  end if;

  select * into v_forn from public.cotacao_fornecedores
  where id = p_fornecedor_id and "cotacaoId" = p_cotacao_id;
  if not found then
    raise exception 'fornecedor nao participa desta cotacao' using errcode = 'P0002';
  end if;

  -- Um vencedor geral por cotacao
  update public.cotacao_fornecedores set vencedor = (id = p_fornecedor_id)
  where "cotacaoId" = p_cotacao_id;

  -- Os itens do vencedor passam a ser os escolhidos
  update public.cotacao_precos p set vencedor = false
  where p."cotacaoItemId" in (select id from public.cotacao_itens where "cotacaoId" = p_cotacao_id);

  update public.cotacao_precos p set vencedor = true
  where p."cotacaoFornecedorId" = p_fornecedor_id and p.disponivel;

  update public.cotacoes set
    status = 'DECIDIDA',
    "decididaEm" = now(),
    "motivoDecisao" = p_motivo,
    "atualizadoEm" = now()
  where id = p_cotacao_id;

  -- Total do vencedor: itens disponiveis + frete - desconto
  select coalesce(sum(i.quantidade * p."precoUnit"), 0) + v_forn.frete - v_forn.desconto
    into v_total
  from public.cotacao_precos p
  join public.cotacao_itens i on i.id = p."cotacaoItemId"
  where p."cotacaoFornecedorId" = p_fornecedor_id and p.disponivel;

  select f.nome into v_nome from public.fornecedores f where f.id = v_forn."fornecedorId";

  if p_gerar_despesa and v_total > 0 then
    select id into v_categoria from public.categorias_financeiras
      where tipo = 'DESPESA' and nome = 'Peças' limit 1;
    if v_categoria is null then
      select id into v_categoria from public.categorias_financeiras
        where tipo = 'DESPESA' and nome = 'Materiais e insumos' limit 1;
    end if;

    v_lancamento := gen_random_uuid()::text;
    insert into public.lancamentos
      (id, tipo, status, descricao, valor, vencimento, "categoriaId", "ordemId",
       fornecedor, observacoes, "criadoEm", "atualizadoEm")
    values
      (v_lancamento, 'DESPESA', 'PENDENTE',
       'Cotação ' || v_cot.numero || ' - ' || v_cot.descricao,
       v_total, coalesce(p_vencimento, now() + interval '30 days'),
       v_categoria, v_cot."ordemId", v_nome,
       'Gerado pela decisão da cotação ' || v_cot.numero, now(), now());
  end if;

  return jsonb_build_object(
    'ok', true,
    'fornecedor', v_nome,
    'total', v_total,
    'lancamento_gerado', v_lancamento is not null
  );
end;
$$;

revoke all on function public.decidir_cotacao from public, anon;
grant execute on function public.decidir_cotacao to authenticated;

-- Categoria de despesa para peças, se ainda não existir
insert into public.categorias_financeiras (id, nome, tipo, ativo)
select gen_random_uuid()::text, 'Peças', 'DESPESA', true
where not exists (
  select 1 from public.categorias_financeiras where nome = 'Peças'
);
