-- Folha de pagamento e custo de pessoal.
--
-- O que isto e, e o que NAO e: um calculo de CUSTO DE PESSOAL para gestao —
-- quanto a equipe custa por mes, quanto sai de comissao, quanto sobra. Nao e
-- folha fiscal: nao emite guia, nao gera eSocial, nao substitui a contabilidade.
-- Por isso os encargos sao percentuais configuraveis e nao regras de lei
-- embutidas: o regime tributario varia por empresa e por anexo, e chutar isso
-- no codigo daria um numero errado com cara de certo.
--
-- O ganho concreto: hoje o custo da equipe so entrava no financeiro se alguem
-- digitasse uma despesa a mao, e as comissoes ficavam acumuladas sem virar
-- pagamento (havia R$ 27 mil em aberto quando isto foi escrito).

-- ------------------------------------------------------------
-- Parametros de encargos
-- ------------------------------------------------------------
create table if not exists public.parametros_rh (
  id                   text primary key default 'default',
  "fgtsPct"            numeric(5,2) not null default 8.00,
  "provisao13Pct"      numeric(5,2) not null default 8.33,
  "provisaoFeriasPct"  numeric(5,2) not null default 11.11,
  "inssPatronalPct"    numeric(5,2) not null default 0.00,
  "outrosEncargosPct"  numeric(5,2) not null default 0.00,
  "diaPagamento"       int not null default 5,
  "atualizadoEm"       timestamptz not null default now(),
  constraint parametros_rh_unico check (id = 'default')
);

comment on table public.parametros_rh is
  'Percentuais de encargos sobre a folha. Ajustaveis porque dependem do regime '
  'tributario da empresa — o padrao assume Simples Nacional, com o INSS patronal '
  'ja recolhido no DAS (por isso zero).';

insert into public.parametros_rh (id) values ('default') on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Folha por competencia
-- ------------------------------------------------------------
create table if not exists public.folhas (
  id             text primary key,
  competencia    text not null unique,          -- 'AAAA-MM'
  status         text not null default 'ABERTA'
                   check (status in ('ABERTA', 'FECHADA', 'CANCELADA')),
  "totalProventos" numeric(12,2) not null default 0,
  "totalDescontos" numeric(12,2) not null default 0,
  "totalLiquido"   numeric(12,2) not null default 0,
  "totalEncargos"  numeric(12,2) not null default 0,
  "custoTotal"     numeric(12,2) not null default 0,
  "fechadaEm"    timestamptz,
  observacoes    text,
  "criadoEm"     timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

comment on table public.folhas is
  'Uma linha por mes. ABERTA pode ser recalculada; FECHADA ja virou despesa no '
  'financeiro e nao se mexe mais.';

create table if not exists public.folha_itens (
  id              text primary key,
  "folhaId"       text not null references public.folhas (id) on delete cascade,
  "funcionarioId" text not null references public.funcionarios (id) on delete restrict,
  "salarioBase"   numeric(10,2) not null default 0,
  comissoes       numeric(10,2) not null default 0,
  adicionais      numeric(10,2) not null default 0,   -- bonus, hora extra
  "descontoFaltas" numeric(10,2) not null default 0,
  "outrosDescontos" numeric(10,2) not null default 0, -- adiantamento, vale
  liquido         numeric(10,2) not null default 0,
  encargos        numeric(10,2) not null default 0,
  "custoTotal"    numeric(10,2) not null default 0,
  faltas          int not null default 0,
  observacoes     text,
  unique ("folhaId", "funcionarioId")
);

create index if not exists folha_itens_folha_idx on public.folha_itens ("folhaId");
create index if not exists folha_itens_func_idx  on public.folha_itens ("funcionarioId");

-- Liga a comissao a folha em que ela foi paga, para nao pagar duas vezes.
alter table public.comissoes
  add column if not exists "folhaId" text references public.folhas (id) on delete set null;
create index if not exists comissoes_folha_idx on public.comissoes ("folhaId");

-- ------------------------------------------------------------
-- RLS: folha expoe salario, entao e assunto de gestao
-- ------------------------------------------------------------
alter table public.parametros_rh enable row level security;
alter table public.folhas        enable row level security;
alter table public.folha_itens   enable row level security;
revoke all on public.parametros_rh from anon;
revoke all on public.folhas        from anon;
revoke all on public.folha_itens   from anon;

drop policy if exists parametros_rh_ler on public.parametros_rh;
create policy parametros_rh_ler on public.parametros_rh
  for select to authenticated using (public.eh_gestao());
drop policy if exists parametros_rh_escrever on public.parametros_rh;
create policy parametros_rh_escrever on public.parametros_rh
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists folhas_ler on public.folhas;
create policy folhas_ler on public.folhas
  for select to authenticated using (public.eh_gestao());
drop policy if exists folhas_escrever on public.folhas;
create policy folhas_escrever on public.folhas
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

-- O item traz o salario de cada pessoa: so gestao ve, nunca o colega de equipe.
drop policy if exists folha_itens_ler on public.folha_itens;
create policy folha_itens_ler on public.folha_itens
  for select to authenticated using (public.eh_gestao());
drop policy if exists folha_itens_escrever on public.folha_itens;
create policy folha_itens_escrever on public.folha_itens
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

-- ------------------------------------------------------------
-- Gerar (ou regerar) a folha de uma competencia
-- ------------------------------------------------------------
create or replace function public.gerar_folha(p_competencia text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_folha    public.folhas%rowtype;
  v_id       text;
  v_ini      date;
  v_fim      date;
  v_par      public.parametros_rh%rowtype;
  v_pct      numeric(6,2);
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_competencia !~ '^\d{4}-\d{2}$' then
    raise exception 'competencia deve ser AAAA-MM' using errcode = 'P0001';
  end if;

  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month')::date;

  select * into v_par from public.parametros_rh where id = 'default';
  v_pct := coalesce(v_par."fgtsPct", 0) + coalesce(v_par."provisao13Pct", 0)
         + coalesce(v_par."provisaoFeriasPct", 0) + coalesce(v_par."inssPatronalPct", 0)
         + coalesce(v_par."outrosEncargosPct", 0);

  select * into v_folha from public.folhas where competencia = p_competencia;
  if found then
    if v_folha.status = 'FECHADA' then
      raise exception 'a folha de % ja foi fechada', p_competencia
        using errcode = 'P0001';
    end if;
    v_id := v_folha.id;
    -- Regerar apaga os itens: o usuario pode ter admitido ou demitido alguem.
    delete from public.folha_itens where "folhaId" = v_id;
  else
    v_id := gen_random_uuid()::text;
    insert into public.folhas (id, competencia) values (v_id, p_competencia);
  end if;

  insert into public.folha_itens
    (id, "folhaId", "funcionarioId", "salarioBase", comissoes, "descontoFaltas",
     faltas, liquido, encargos, "custoTotal")
  select
    gen_random_uuid()::text,
    v_id,
    f.id,
    coalesce(f.salario, 0),
    coalesce(c.total, 0),
    -- Falta desconta 1/30 do salario. E a conta simples de gestao; o calculo
    -- legal envolve DSR e fica com a contabilidade.
    round(coalesce(f.salario, 0) / 30 * coalesce(o.faltas, 0), 2),
    coalesce(o.faltas, 0),
    0, 0, 0
  from public.funcionarios f
  left join lateral (
    select sum(cm.valor) total
    from public.comissoes cm
    where cm."funcionarioId" = f.id
      and not cm.pago
      and cm."folhaId" is null
      and cm.referencia = p_competencia
  ) c on true
  left join lateral (
    select count(*) faltas
    from public.ocorrencias_rh oc
    where oc."funcionarioId" = f.id
      and oc.tipo = 'FALTA'
      and oc.inicio >= v_ini and oc.inicio < v_fim
  ) o on true
  where f.ativo
    -- Quem foi admitido depois do mes, ou desligado antes dele, fica de fora.
    and f.admissao < v_fim
    and (f.demissao is null or f.demissao >= v_ini);

  update public.folha_itens
  set liquido = "salarioBase" + comissoes + adicionais - "descontoFaltas" - "outrosDescontos",
      encargos = round(("salarioBase" + comissoes + adicionais - "descontoFaltas"
                        - "outrosDescontos") * v_pct / 100, 2)
  where "folhaId" = v_id;

  update public.folha_itens
  set "custoTotal" = liquido + encargos
  where "folhaId" = v_id;

  perform public.recalcular_folha(v_id);
  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- Somar os itens de volta na folha
-- ------------------------------------------------------------
create or replace function public.recalcular_folha(p_folha_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  update public.folhas f
  set "totalProventos" = coalesce(t.proventos, 0),
      "totalDescontos" = coalesce(t.descontos, 0),
      "totalLiquido"   = coalesce(t.liquido, 0),
      "totalEncargos"  = coalesce(t.encargos, 0),
      "custoTotal"     = coalesce(t.custo, 0),
      "atualizadoEm"   = now()
  from (
    select sum("salarioBase" + comissoes + adicionais) proventos,
           sum("descontoFaltas" + "outrosDescontos")   descontos,
           sum(liquido)    liquido,
           sum(encargos)   encargos,
           sum("custoTotal") custo
    from public.folha_itens where "folhaId" = p_folha_id
  ) t
  where f.id = p_folha_id;
end;
$$;

-- ------------------------------------------------------------
-- Fechar: vira despesa no financeiro e quita as comissoes
-- ------------------------------------------------------------
create or replace function public.fechar_folha(p_folha_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_folha     public.folhas%rowtype;
  v_par       public.parametros_rh%rowtype;
  v_cat_folha text;
  v_venc      date;
  v_comissoes int;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_folha from public.folhas where id = p_folha_id for update;
  if not found then
    raise exception 'folha nao encontrada' using errcode = 'P0002';
  end if;
  if v_folha.status = 'FECHADA' then
    raise exception 'esta folha ja foi fechada' using errcode = 'P0001';
  end if;
  if v_folha."custoTotal" <= 0 then
    raise exception 'a folha esta zerada; gere os itens antes de fechar'
      using errcode = 'P0001';
  end if;

  select * into v_par from public.parametros_rh where id = 'default';
  select id into v_cat_folha from public.categorias_financeiras
  where nome = 'Folha de pagamento' limit 1;

  -- Vence no dia configurado do mes SEGUINTE a competencia: trabalho de
  -- setembro se paga em outubro.
  v_venc := (to_date(v_folha.competencia || '-01', 'YYYY-MM-DD') + interval '1 month')::date
            + (coalesce(v_par."diaPagamento", 5) - 1);

  -- Dois lancamentos separados de proposito: o liquido e o que sai para as
  -- pessoas, os encargos sao recolhimento. Juntar esconderia o peso real de
  -- cada um na hora de analisar o mes.
  insert into public.lancamentos
    (id, tipo, status, descricao, valor, vencimento, "categoriaId", observacoes,
     "criadoEm", "atualizadoEm")
  values
    (gen_random_uuid()::text, 'DESPESA', 'PENDENTE',
     'Salarios e comissoes — ' || v_folha.competencia,
     v_folha."totalLiquido", v_venc, v_cat_folha,
     'Gerado pelo fechamento da folha.', now(), now());

  if v_folha."totalEncargos" > 0 then
    insert into public.lancamentos
      (id, tipo, status, descricao, valor, vencimento, "categoriaId", observacoes,
       "criadoEm", "atualizadoEm")
    values
      (gen_random_uuid()::text, 'DESPESA', 'PENDENTE',
       'Encargos sobre a folha — ' || v_folha.competencia,
       v_folha."totalEncargos", v_venc, v_cat_folha,
       'FGTS e provisoes de 13o e ferias.', now(), now());
  end if;

  -- Quita as comissoes que entraram nesta folha.
  update public.comissoes
  set pago = true, "pagoEm" = now(), "folhaId" = p_folha_id
  where referencia = v_folha.competencia and not pago and "folhaId" is null;
  get diagnostics v_comissoes = row_count;

  update public.folhas
  set status = 'FECHADA', "fechadaEm" = now(), "atualizadoEm" = now()
  where id = p_folha_id;

  return jsonb_build_object(
    'competencia', v_folha.competencia,
    'liquido', v_folha."totalLiquido",
    'encargos', v_folha."totalEncargos",
    'custo_total', v_folha."custoTotal",
    'comissoes_quitadas', v_comissoes,
    'vencimento', v_venc
  );
end;
$$;

revoke all on function public.gerar_folha       from public, anon;
revoke all on function public.recalcular_folha  from public, anon;
revoke all on function public.fechar_folha      from public, anon;
grant execute on function public.gerar_folha      to authenticated;
grant execute on function public.recalcular_folha to authenticated;
grant execute on function public.fechar_folha     to authenticated;
