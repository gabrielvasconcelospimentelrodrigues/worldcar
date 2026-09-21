-- Demonstrativo do mes e fluxo de caixa.
--
-- Antes o financeiro somava receita e despesa e mostrava a diferenca. Isso diz
-- se sobrou dinheiro, mas nao diz POR QUE: um mes ruim por queda de vendas e um
-- mes ruim por explosao no custo de peca pedem decisoes opostas, e os dois
-- apareciam como "resultado menor".
--
-- Agrupar por natureza resolve. Custo variavel acompanha o movimento (peca,
-- tinta, insumo); pessoal e fixa nao. Ver os tres separados mostra onde mexer.

alter table public.categorias_financeiras
  add column if not exists grupo text not null default 'OUTROS'
    check (grupo in ('RECEITA', 'CUSTO_VARIAVEL', 'PESSOAL', 'FIXA', 'IMPOSTO', 'OUTROS'));

comment on column public.categorias_financeiras.grupo is
  'Natureza da linha no demonstrativo. CUSTO_VARIAVEL acompanha o faturamento; '
  'PESSOAL e FIXA seguem mesmo com o patio vazio.';

-- Classifica as categorias que ja existiam.
update public.categorias_financeiras set grupo = case
  when tipo = 'RECEITA'                                then 'RECEITA'
  when nome in ('Peças', 'Materiais e insumos')        then 'CUSTO_VARIAVEL'
  when nome = 'Folha de pagamento'                     then 'PESSOAL'
  when nome in ('Aluguel', 'Energia e água',
                'Manutenção e equipamentos', 'Marketing') then 'FIXA'
  when nome = 'Impostos e taxas'                       then 'IMPOSTO'
  else 'OUTROS'
end
where grupo = 'OUTROS';

-- ------------------------------------------------------------
-- Demonstrativo de um mes
-- ------------------------------------------------------------
create or replace function public.dre_mensal(p_competencia text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date;
  v_fim date;
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_competencia !~ '^\d{4}-\d{2}$' then
    raise exception 'competencia deve ser AAAA-MM' using errcode = 'P0001';
  end if;

  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month')::date;

  -- Regime de caixa: conta o que foi efetivamente pago ou recebido no mes.
  -- E o que o dono da oficina enxerga na conta bancaria.
  with movimento as (
    select l.tipo, l.valor,
           coalesce(c.grupo, case when l.tipo = 'RECEITA' then 'RECEITA' else 'OUTROS' end) grupo
    from public.lancamentos l
    left join public.categorias_financeiras c on c.id = l."categoriaId"
    where l.status = 'PAGO'
      and l.pagamento >= v_ini and l.pagamento < v_fim
  ),
  soma as (
    select
      coalesce(sum(valor) filter (where tipo = 'RECEITA'), 0)              receita,
      coalesce(sum(valor) filter (where grupo = 'CUSTO_VARIAVEL'), 0)      custo_variavel,
      coalesce(sum(valor) filter (where grupo = 'PESSOAL'), 0)             pessoal,
      coalesce(sum(valor) filter (where grupo = 'FIXA'), 0)                fixas,
      coalesce(sum(valor) filter (where grupo = 'IMPOSTO'), 0)             impostos,
      coalesce(sum(valor) filter (where tipo = 'DESPESA' and grupo = 'OUTROS'), 0) outras
    from movimento
  )
  select jsonb_build_object(
    'competencia', p_competencia,
    'receita', receita,
    'custo_variavel', custo_variavel,
    'margem_bruta', receita - custo_variavel,
    'pessoal', pessoal,
    'fixas', fixas,
    'impostos', impostos,
    'outras', outras,
    'despesa_total', custo_variavel + pessoal + fixas + impostos + outras,
    'resultado', receita - (custo_variavel + pessoal + fixas + impostos + outras),
    -- Percentuais sobre a receita: R$ 30 mil de pessoal significa coisas bem
    -- diferentes num mes de 80 mil e num de 200 mil.
    'pct_custo_variavel', case when receita > 0 then round(custo_variavel * 100 / receita, 1) else 0 end,
    'pct_pessoal',        case when receita > 0 then round(pessoal * 100 / receita, 1) else 0 end,
    'pct_fixas',          case when receita > 0 then round(fixas * 100 / receita, 1) else 0 end,
    'pct_margem',         case when receita > 0
                            then round((receita - (custo_variavel + pessoal + fixas + impostos + outras)) * 100 / receita, 1)
                            else 0 end
  ) into v_res
  from soma;

  return v_res;
end;
$$;

-- ------------------------------------------------------------
-- Fluxo de caixa dos ultimos meses
-- ------------------------------------------------------------
create or replace function public.fluxo_caixa(p_meses int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  with meses as (
    select generate_series(
      date_trunc('month', now()) - make_interval(months => greatest(p_meses, 1) - 1),
      date_trunc('month', now()),
      interval '1 month'
    )::date mes
  )
  select jsonb_agg(jsonb_build_object(
    'mes', to_char(m.mes, 'YYYY-MM'),
    'receita', coalesce(r.v, 0),
    'despesa', coalesce(d.v, 0),
    'resultado', coalesce(r.v, 0) - coalesce(d.v, 0)
  ) order by m.mes)
  into v_res
  from meses m
  left join lateral (
    select sum(valor) v from public.lancamentos
    where tipo = 'RECEITA' and status = 'PAGO'
      and pagamento >= m.mes and pagamento < m.mes + interval '1 month'
  ) r on true
  left join lateral (
    select sum(valor) v from public.lancamentos
    where tipo = 'DESPESA' and status = 'PAGO'
      and pagamento >= m.mes and pagamento < m.mes + interval '1 month'
  ) d on true;

  return coalesce(v_res, '[]'::jsonb);
end;
$$;

revoke all on function public.dre_mensal  from public, anon;
revoke all on function public.fluxo_caixa from public, anon;
grant execute on function public.dre_mensal  to authenticated;
grant execute on function public.fluxo_caixa to authenticated;
