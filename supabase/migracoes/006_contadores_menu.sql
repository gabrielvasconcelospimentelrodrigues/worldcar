-- Contadores para as bolinhas de alerta do menu lateral.
--
-- Uma funcao so, em vez de o navegador disparar sete `count` separados: o menu
-- aparece em toda tela do sistema e sete idas ao banco a cada navegacao seria
-- desperdicio. Cada numero significa "isto aqui espera uma acao humana" — nao e
-- o total do modulo, senao a bolinha nunca zeraria e viraria enfeite.
create or replace function public.contadores_menu()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    -- Orcamento enviado que ainda nao virou OS e esta perto de vencer
    'orcamentos', (
      select count(*) from public.orcamentos
      where status = 'ENVIADO'
        and "validoAte" <= now() + interval '3 days'
    ),
    -- Carro pronto que o cliente ainda nao retirou
    'ordens', (
      select count(*) from public.ordens_servico where status = 'PRONTA'
    ),
    -- OS em andamento sem vistoria de entrada registrada
    'vistorias', (
      select count(*) from public.ordens_servico o
      where o.status in ('AGUARDANDO','EM_ANDAMENTO','PAUSADA')
        and not exists (
          select 1 from public.vistorias v
          where v."ordemId" = o.id and v.tipo = 'ENTRADA'
        )
    ),
    -- Alerta vencido ou para hoje
    'alertas', (
      select count(*) from public.alertas
      where status = 'PENDENTE'
        and "dataAlvo" < date_trunc('day', now()) + interval '1 day'
    ),
    -- Cotacao esperando decisao, ou cujo prazo de resposta ja passou
    'compras', (
      select count(*) from public.cotacoes
      where status = 'RESPONDIDA'
         or (status = 'ABERTA' and "prazoResposta" is not null and "prazoResposta" < now())
    ),
    -- Conta vencida e ainda nao paga
    'financeiro', (
      select count(*) from public.lancamentos
      where status in ('PENDENTE','ATRASADO') and vencimento < now()
    )
  )
  where public.eh_equipe();
$$;

revoke all on function public.contadores_menu from public, anon;
grant execute on function public.contadores_menu to authenticated;
