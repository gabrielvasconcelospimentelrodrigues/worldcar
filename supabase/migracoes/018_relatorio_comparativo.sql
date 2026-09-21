-- Relatorios: comparacao com o periodo anterior e evolucao mes a mes.
--
-- Numero sozinho nao informa. "R$ 180 mil no mes" pode ser o melhor mes do ano
-- ou uma queda de 20%, e sem o periodo anterior ao lado ninguem sabe qual dos
-- dois. Toda leitura de gestao e comparativa.
--
-- O periodo anterior tem o MESMO tamanho e termina onde o atual comeca: 30 dias
-- se comparam com 30 dias. Comparar um mes com o ano inteiro daria variacao
-- sempre negativa e ninguem entenderia o motivo.

-- ------------------------------------------------------------
-- Panorama com comparacao
-- ------------------------------------------------------------
create or replace function public.panorama_comparado(
  p_inicio date,
  p_fim    date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dias    int;
  v_ini_ant date;
  v_fim_ant date;
  v_res     jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'periodo invalido' using errcode = 'P0001';
  end if;

  v_dias    := p_fim - p_inicio;
  v_fim_ant := p_inicio;
  v_ini_ant := p_inicio - v_dias;

  with base as (
    select
      m.janela,
      coalesce(sum(l.valor) filter (where l.status = 'PAGO'), 0) as recebido,
      count(distinct o.id)                                       as ordens,
      count(distinct o."clienteId")                              as clientes
    from (values ('atual', p_inicio, p_fim), ('anterior', v_ini_ant, v_fim_ant))
           as m(janela, ini, fim)
    left join public.lancamentos l
      on l.tipo = 'RECEITA' and l.pagamento >= m.ini and l.pagamento < m.fim
    left join public.ordens_servico o
      on o.id = l."ordemId"
    group by m.janela
  ),
  servicos as (
    select
      m.janela,
      count(*)                as itens,
      coalesce(sum(i.total), 0) as producao
    from (values ('atual', p_inicio, p_fim), ('anterior', v_ini_ant, v_fim_ant))
           as m(janela, ini, fim)
    left join public.ordens_servico o
      on o.status = 'ENTREGUE' and o."dataSaida" >= m.ini and o."dataSaida" < m.fim
    left join public.os_itens i
      on i."ordemId" = o.id and i.status = 'CONCLUIDO'
    group by m.janela
  ),
  orcs as (
    select
      m.janela,
      count(q.id)                                          as emitidos,
      count(q.id) filter (where q.status = 'CONVERTIDO')   as convertidos
    from (values ('atual', p_inicio, p_fim), ('anterior', v_ini_ant, v_fim_ant))
           as m(janela, ini, fim)
    left join public.orcamentos q
      on q."criadoEm" >= m.ini and q."criadoEm" < m.fim
    group by m.janela
  )
  select jsonb_object_agg(
    b.janela,
    jsonb_build_object(
      'recebido',      b.recebido,
      'ordens',        b.ordens,
      'clientes',      b.clientes,
      'itens',         coalesce(s.itens, 0),
      'ticket',        case when b.ordens > 0
                         then round(b.recebido / b.ordens, 2) else 0 end,
      'orcamentos',    coalesce(o.emitidos, 0),
      'convertidos',   coalesce(o.convertidos, 0),
      'conversao',     case when coalesce(o.emitidos, 0) > 0
                         then round(o.convertidos * 100.0 / o.emitidos, 1) else 0 end
    )
  ) into v_res
  from base b
  left join servicos s on s.janela = b.janela
  left join orcs o on o.janela = b.janela;

  return coalesce(v_res, '{}'::jsonb)
    || jsonb_build_object(
         'inicio', p_inicio, 'fim', p_fim,
         'inicio_anterior', v_ini_ant, 'fim_anterior', v_fim_ant,
         'dias', v_dias);
end;
$$;

-- ------------------------------------------------------------
-- Evolucao mes a mes dentro do periodo
-- ------------------------------------------------------------
create or replace function public.evolucao_periodo(
  p_inicio date,
  p_fim    date
)
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
      date_trunc('month', p_inicio::timestamptz),
      date_trunc('month', (p_fim - 1)::timestamptz),
      interval '1 month'
    )::date mes
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'mes',      to_char(m.mes, 'YYYY-MM'),
    'recebido', coalesce(r.v, 0),
    'ordens',   coalesce(o.n, 0),
    'ticket',   case when coalesce(o.n, 0) > 0
                  then round(coalesce(r.v, 0) / o.n, 2) else 0 end,
    -- Cliente que aparece pela primeira vez no mes: mede captacao, nao volume.
    'novos',    coalesce(n.n, 0)
  ) order by m.mes), '[]'::jsonb) into v_res
  from meses m
  left join lateral (
    select sum(valor) v from public.lancamentos
    where tipo = 'RECEITA' and status = 'PAGO'
      and pagamento >= m.mes and pagamento < m.mes + interval '1 month'
  ) r on true
  left join lateral (
    select count(*) n from public.ordens_servico
    where status = 'ENTREGUE'
      and "dataSaida" >= m.mes and "dataSaida" < m.mes + interval '1 month'
  ) o on true
  left join lateral (
    select count(*) n from (
      select o2."clienteId", min(o2."dataEntrada") primeira
      from public.ordens_servico o2
      group by o2."clienteId"
    ) t
    where t.primeira >= m.mes and t.primeira < m.mes + interval '1 month'
  ) n on true;

  return v_res;
end;
$$;

revoke all on function public.panorama_comparado(date, date) from public, anon;
revoke all on function public.evolucao_periodo(date, date)   from public, anon;
grant execute on function public.panorama_comparado(date, date) to authenticated;
grant execute on function public.evolucao_periodo(date, date)   to authenticated;
