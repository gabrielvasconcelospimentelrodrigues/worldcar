-- Desconto fixo negociado com um cliente especifico.
--
-- Ex.: uma locadora que traz dez carros por mes tem 10% em tudo. Antes isso
-- dependia de o atendente lembrar e digitar o desconto em cada orcamento — e
-- esquecer significava cobrar a mais de quem tem acordo.
--
-- Fica em percentual, nao em valor: o acordo comercial e "10% em tudo", nao
-- "R$ 50 por ordem", e o valor teria de ser recalculado a cada servico.

alter table public.clientes
  add column if not exists "descontoPct" numeric(5,2) not null default 0
    check ("descontoPct" >= 0 and "descontoPct" <= 100);

comment on column public.clientes."descontoPct" is
  'Desconto padrao do cliente, aplicado sozinho em novos orcamentos e ordens.';

-- A OS ganha o mesmo par tipo+valor que o orcamento ja tinha, senao o desconto
-- percentual se perderia na conversao de orcamento para ordem.
alter table public.ordens_servico
  add column if not exists "descontoTipo" text not null default 'VALOR'
    check ("descontoTipo" in ('VALOR','PERCENTUAL'));

-- ------------------------------------------------------------
-- Recalculo da OS ciente do desconto percentual
-- ------------------------------------------------------------
create or replace function public.recalcular_ordem(p_ordem_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_subtotal numeric(10,2);
  v_desconto numeric(10,2);
  v_tipo     text;
  v_abatido  numeric(10,2);
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(sum(total), 0) into v_subtotal
  from public.os_itens
  where "ordemId" = p_ordem_id and status <> 'CANCELADO';

  select desconto, "descontoTipo" into v_desconto, v_tipo
  from public.ordens_servico where id = p_ordem_id;

  -- Em PERCENTUAL a coluna `desconto` guarda o percentual, nao reais: e a mesma
  -- convencao que o orcamento ja usava, mantida para os dois lerem igual.
  v_abatido := case
    when v_tipo = 'PERCENTUAL'
      then round(v_subtotal * least(greatest(coalesce(v_desconto, 0), 0), 100) / 100, 2)
    else greatest(coalesce(v_desconto, 0), 0)
  end;

  update public.ordens_servico
  set subtotal = v_subtotal,
      total = greatest(0, v_subtotal - v_abatido)
  where id = p_ordem_id;
end;
$$;

-- ------------------------------------------------------------
-- Conversao de orcamento em OS levando o tipo de desconto junto
-- ------------------------------------------------------------
-- Sem isto, um orcamento com 10% viraria uma OS com "desconto = 10" lido como
-- R$ 10,00 — o cliente perderia o acordo exatamente na hora de pagar.
do $$
declare
  v_fonte text;
begin
  select pg_get_functiondef(oid) into v_fonte
  from pg_proc where proname = 'converter_orcamento' limit 1;

  if v_fonte is null then
    raise notice 'converter_orcamento nao existe; nada a ajustar';
    return;
  end if;

  v_fonte := replace(v_fonte,
    'subtotal, desconto, total, observacoes, "criadoEm", "atualizadoEm")',
    'subtotal, desconto, "descontoTipo", total, observacoes, "criadoEm", "atualizadoEm")');
  v_fonte := replace(v_fonte,
    'v_orc.subtotal, v_orc.desconto, v_orc.total, v_orc.observacoes, now(), now())',
    'v_orc.subtotal, v_orc.desconto, v_orc."descontoTipo", v_orc.total, v_orc.observacoes, now(), now())');

  execute v_fonte;
end $$;

revoke all on function public.recalcular_ordem from public, anon;
grant execute on function public.recalcular_ordem to authenticated;
