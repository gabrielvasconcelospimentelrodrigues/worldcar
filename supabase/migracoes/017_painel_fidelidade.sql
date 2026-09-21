-- Visao de gestao do programa de fidelidade.
--
-- O numero que faltava e o PASSIVO: pontos em circulacao vezes o valor do
-- ponto. E desconto ja prometido, que vai sair do caixa em algum mes futuro.
-- Programa de pontos sem essa conta a vista e uma divida que ninguem mediu —
-- e a hora de descobrir nao pode ser quando trinta clientes resgatam no mesmo
-- mes.

create or replace function public.painel_fidelidade()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par public.parametros_fidelidade%rowtype;
  v_res jsonb;
begin
  if not public.eh_gestao() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_par from public.parametros_fidelidade where id = 'default';

  select jsonb_build_object(
    'ativo',            coalesce(v_par.ativo, false),
    'participantes',    coalesce(p.participantes, 0),
    'pontos_ativos',    coalesce(p.pontos, 0),
    -- Quanto a oficina deve em desconto se todo mundo resgatar hoje.
    'passivo',          round(coalesce(p.pontos, 0) * coalesce(v_par."valorDoPonto", 0), 2),
    'pontos_concedidos_mes', coalesce(m.ganhos, 0),
    'pontos_resgatados_mes', coalesce(m.resgates, 0),
    'valor_resgatado_mes',   coalesce(m.valor_resgatado, 0),
    -- Ponto que vence nos proximos 60 dias: motivo para chamar o cliente de
    -- volta antes de o beneficio virar po.
    'vencendo_60d',     coalesce(v.pontos, 0),
    'clientes_vencendo', coalesce(v.clientes, 0),
    'por_nivel', coalesce(n.niveis, '[]'::jsonb)
  ) into v_res
  from (
    select count(*) filter (where pontos > 0) participantes, sum(pontos) pontos
    from public.fidelidade_saldo
  ) p
  cross join (
    select
      coalesce(sum(pontos) filter (where tipo = 'GANHO'), 0)    ganhos,
      coalesce(-sum(pontos) filter (where tipo = 'RESGATE'), 0) resgates,
      coalesce(sum("valorBase") filter (where tipo = 'RESGATE'), 0) valor_resgatado
    from public.fidelidade_movimentos
    where "criadoEm" >= date_trunc('month', now())
  ) m
  cross join (
    select coalesce(sum(pontos), 0) pontos, count(distinct "clienteId") clientes
    from public.fidelidade_movimentos
    where pontos > 0 and "expiraEm" is not null
      and "expiraEm" between now() and now() + interval '60 days'
  ) v
  cross join (
    select jsonb_agg(jsonb_build_object(
      'nivel', nivel, 'clientes', qtd, 'pontos', pts, 'gasto', gasto
    ) order by ordem) niveis
    from (
      select nivel, count(*) qtd, sum(pontos) pts, sum("gasto12m") gasto,
             case nivel when 'DIAMANTE' then 1 when 'OURO' then 2
                        when 'PRATA' then 3 else 4 end ordem
      from public.fidelidade_saldo
      group by nivel
    ) t
  ) n;

  return v_res;
end;
$$;

revoke all on function public.painel_fidelidade from public, anon;
grant execute on function public.painel_fidelidade to authenticated;
