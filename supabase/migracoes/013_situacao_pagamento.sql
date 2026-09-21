-- Situacao de pagamento de cada OS, pronta para as listagens.
--
-- Nas listas so aparecia o TOTAL da OS, que e o valor cobrado — nao o recebido.
-- Duas ordens de R$ 2.000 apareciam identicas: uma quitada no PIX, a outra com
-- R$ 1.400 ainda a receber. Quem olha a lista precisa justamente distinguir as
-- duas, porque uma exige cobranca e a outra nao.
--
-- E view, e nao consulta montada no navegador, porque somar recebimento por OS
-- do lado do cliente exigiria trazer todos os lancamentos de cem ordens so para
-- reduzi-los a um rotulo.
--
-- `security_invoker` e o ponto sensivel: sem ele a view rodaria com os direitos
-- de quem a criou e furaria a RLS, expondo valores de OS que aquele usuario nao
-- pode ver. Com ele, as politicas das tabelas de origem continuam valendo.
create or replace view public.situacao_pagamento_os
with (security_invoker = true) as
select
  o.id                                        as "ordemId",
  o.total,
  coalesce(r.pago, 0)                         as pago,
  coalesce(r.aberto, 0)                       as aberto,
  greatest(o.total - coalesce(r.pago, 0), 0)  as falta,
  coalesce(r.vencidas, 0)                     as vencidas,
  case
    -- Ordem sem valor nenhum: cortesia, garantia, retrabalho.
    when o.total <= 0                                    then 'SEM_COBRANCA'
    when coalesce(r.pago, 0) >= o.total - 0.005          then 'QUITADA'
    when coalesce(r.vencidas, 0) > 0                     then 'ATRASADA'
    when coalesce(r.pago, 0) > 0.005                     then 'PARCIAL'
    when coalesce(r.aberto, 0) > 0.005                   then 'A_RECEBER'
    else 'NAO_LANCADO'
  end                                         as situacao
from public.ordens_servico o
left join lateral (
  select
    sum(l.valor) filter (where l.status = 'PAGO')                          as pago,
    sum(l.valor) filter (where l.status in ('PENDENTE','ATRASADO'))        as aberto,
    count(*) filter (where l.status in ('PENDENTE','ATRASADO')
                       and l.vencimento < now())                           as vencidas
  from public.lancamentos l
  where l."ordemId" = o.id and l.tipo = 'RECEITA'
) r on true;

comment on view public.situacao_pagamento_os is
  'Resumo de recebimento por OS para as listagens. NAO_LANCADO e a OS entregue '
  'sem nenhuma receita lancada — normalmente erro de operacao, nao inadimplencia.';

grant select on public.situacao_pagamento_os to authenticated;
revoke all on public.situacao_pagamento_os from anon;
