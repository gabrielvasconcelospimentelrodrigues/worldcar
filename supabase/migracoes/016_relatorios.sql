-- Relatorios e rankings.
--
-- Tudo aqui parte do que foi RECEBIDO, nao do que foi faturado. Ranking por
-- valor cobrado premia quem gera nota e nao paga, e ja houve cliente no topo
-- de lista assim em sistema que mede errado.
--
-- As funcoes recebem o periodo em vez de assumir "mes atual": a mesma tela
-- serve para fechar o mes, comparar o trimestre e montar o ano.

-- ------------------------------------------------------------
-- Ranking de clientes
-- ------------------------------------------------------------
create or replace function public.ranking_clientes(
  p_inicio date default null,
  p_fim    date default null,
  p_limite int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date := coalesce(p_inicio, (now() - interval '12 months')::date);
  v_fim date := coalesce(p_fim, (now() + interval '1 day')::date);
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x.gasto desc), '[]'::jsonb) into v_res
  from (
    select
      c.id,
      c.nome,
      c.telefone,
      c.tipo,
      sum(l.valor)                            as gasto,
      count(distinct o.id)                    as visitas,
      round(sum(l.valor) / greatest(count(distinct o.id), 1), 2) as ticket,
      max(o."dataSaida")                      as ultima,
      -- Dias desde a ultima visita: o numero que revela quem sumiu.
      (now()::date - max(o."dataSaida")::date) as dias_sem_vir
    from public.lancamentos l
    join public.ordens_servico o on o.id = l."ordemId"
    join public.clientes c on c.id = o."clienteId"
    where l.tipo = 'RECEITA' and l.status = 'PAGO'
      and l.pagamento >= v_ini and l.pagamento < v_fim
    group by c.id, c.nome, c.telefone, c.tipo
    order by gasto desc
    limit greatest(p_limite, 1)
  ) x;

  return v_res;
end;
$$;

-- ------------------------------------------------------------
-- Ranking de funcionarios
-- ------------------------------------------------------------
create or replace function public.ranking_funcionarios(
  p_inicio date default null,
  p_fim    date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date := coalesce(p_inicio, (now() - interval '12 months')::date);
  v_fim date := coalesce(p_fim, (now() + interval '1 day')::date);
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x.producao desc), '[]'::jsonb) into v_res
  from (
    select
      f.id,
      f.nome,
      f.cargo,
      f.setor,
      coalesce(s.servicos, 0)      as servicos,
      coalesce(s.producao, 0)      as producao,
      coalesce(cm.comissao, 0)     as comissao,
      coalesce(q.conferidas, 0)    as conferidas,
      coalesce(q.reprovadas, 0)    as reprovadas,
      -- Retrabalho e a medida de qualidade que este sistema ja coleta sozinho,
      -- pela conferencia de limpeza. Producao alta com reprovacao alta nao e
      -- produtividade, e pressa.
      case when coalesce(q.conferidas, 0) > 0
        then round(coalesce(q.reprovadas, 0) * 100.0 / q.conferidas, 1)
        else 0 end                 as pct_retrabalho
    from public.funcionarios f
    left join lateral (
      select count(*) servicos, sum(i.total) producao
      from public.os_itens i
      join public.ordens_servico o on o.id = i."ordemId"
      where i."responsavelId" = f.id and i.status = 'CONCLUIDO'
        and o."dataSaida" >= v_ini and o."dataSaida" < v_fim
    ) s on true
    left join lateral (
      select sum(valor) comissao
      from public.comissoes
      where "funcionarioId" = f.id
        and "criadoEm" >= v_ini and "criadoEm" < v_fim
    ) cm on true
    left join lateral (
      select
        count(distinct v."itemId") filter (where v."itemId" is not null) conferidas,
        count(distinct v."itemId") filter (where v."resultadoLimpeza" = 'REPROVADA') reprovadas
      from public.vistorias v
      join public.os_itens i on i.id = v."itemId"
      where v.tipo = 'LIMPEZA' and i."responsavelId" = f.id
        and v.data >= v_ini and v.data < v_fim
    ) q on true
    where f.ativo
  ) x;

  return v_res;
end;
$$;

-- ------------------------------------------------------------
-- Servicos mais vendidos
-- ------------------------------------------------------------
create or replace function public.ranking_servicos(
  p_inicio date default null,
  p_fim    date default null,
  p_limite int default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date := coalesce(p_inicio, (now() - interval '12 months')::date);
  v_fim date := coalesce(p_fim, (now() + interval '1 day')::date);
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x.faturamento desc), '[]'::jsonb) into v_res
  from (
    select
      coalesce(sv.nome, i.descricao) as nome,
      coalesce(sv.categoria::text, 'OUTROS') as categoria,
      count(*)        as vezes,
      sum(i.total)    as faturamento,
      round(avg(i."precoUnit"), 2) as preco_medio
    from public.os_itens i
    join public.ordens_servico o on o.id = i."ordemId"
    left join public.servicos sv on sv.id = i."servicoId"
    where i.status = 'CONCLUIDO'
      and o."dataSaida" >= v_ini and o."dataSaida" < v_fim
    group by coalesce(sv.nome, i.descricao), coalesce(sv.categoria::text, 'OUTROS')
    order by faturamento desc
    limit greatest(p_limite, 1)
  ) x;

  return v_res;
end;
$$;

-- ------------------------------------------------------------
-- Panorama do periodo, para o topo da tela de relatorios
-- ------------------------------------------------------------
create or replace function public.panorama_periodo(
  p_inicio date default null,
  p_fim    date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date := coalesce(p_inicio, (now() - interval '12 months')::date);
  v_fim date := coalesce(p_fim, (now() + interval '1 day')::date);
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'recebido',       coalesce(r.recebido, 0),
    'a_receber',      coalesce(r.aberto, 0),
    'ordens',         coalesce(o.ordens, 0),
    'ticket_medio',   case when coalesce(o.ordens, 0) > 0
                        then round(coalesce(o.faturado, 0) / o.ordens, 2) else 0 end,
    'clientes',       coalesce(o.clientes, 0),
    -- Cliente que voltou: o indicador que diz se o servico agradou.
    'clientes_recorrentes', coalesce(o.recorrentes, 0),
    'orcamentos',     coalesce(q.total, 0),
    'convertidos',    coalesce(q.convertidos, 0),
    'taxa_conversao', case when coalesce(q.total, 0) > 0
                        then round(coalesce(q.convertidos, 0) * 100.0 / q.total, 1) else 0 end,
    'inicio', v_ini, 'fim', v_fim
  ) into v_res
  from (
    select
      sum(valor) filter (where status = 'PAGO' and pagamento >= v_ini and pagamento < v_fim) recebido,
      sum(valor) filter (where status in ('PENDENTE','ATRASADO')) aberto
    from public.lancamentos where tipo = 'RECEITA'
  ) r
  cross join (
    select count(*) ordens, sum(total) faturado,
           count(distinct "clienteId") clientes,
           count(distinct "clienteId") filter (where vezes > 1) recorrentes
    from (
      select o.*, count(*) over (partition by o."clienteId") vezes
      from public.ordens_servico o
      where o.status = 'ENTREGUE' and o."dataSaida" >= v_ini and o."dataSaida" < v_fim
    ) t
  ) o
  cross join (
    select count(*) total, count(*) filter (where status = 'CONVERTIDO') convertidos
    from public.orcamentos
    where "criadoEm" >= v_ini and "criadoEm" < v_fim
  ) q;

  return v_res;
end;
$$;

revoke all on function public.ranking_clientes(date, date, int)     from public, anon;
revoke all on function public.ranking_funcionarios(date, date)      from public, anon;
revoke all on function public.ranking_servicos(date, date, int)     from public, anon;
revoke all on function public.panorama_periodo(date, date)          from public, anon;
grant execute on function public.ranking_clientes(date, date, int)  to authenticated;
grant execute on function public.ranking_funcionarios(date, date)   to authenticated;
grant execute on function public.ranking_servicos(date, date, int)  to authenticated;
grant execute on function public.panorama_periodo(date, date)       to authenticated;
