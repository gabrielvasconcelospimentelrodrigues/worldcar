-- Vistoria de limpeza (conferencia interna pos-lavagem).
--
-- A oficina tambem e lava a jato, e ali a conferencia nao e a mesma coisa que a
-- vistoria de entrada e de saida. Aquelas documentam o estado do carro para o
-- cliente; esta e controle de qualidade interno: o vistoriador confere o
-- servico antes de o carro ser liberado e, se estiver mal feito, devolve para o
-- mesmo funcionario refazer.
--
-- Fica como um terceiro tipo de vistoria, e nao em tabela propria, porque tudo
-- que ela precisa — quem vistoriou, quando, checklist, fotos — a vistoria ja
-- tem. O que muda e o desfecho: aprovada libera, reprovada gera retrabalho.

alter type "TipoVistoria" add value if not exists 'LIMPEZA';

-- O resultado precisa de tres estados, nao dois: "ainda nao conferida" nao e a
-- mesma coisa que "conferida e reprovada".
alter table public.vistorias
  add column if not exists "resultadoLimpeza" text
    check ("resultadoLimpeza" is null
           or "resultadoLimpeza" in ('APROVADA', 'REPROVADA')),
  add column if not exists "itemId" text
    references public.os_itens (id) on delete cascade,
  add column if not exists "motivoReprovacao" text,
  add column if not exists "refeitaDe" text
    references public.vistorias (id) on delete set null;

comment on column public.vistorias."resultadoLimpeza" is
  'So para tipo LIMPEZA: APROVADA libera o carro, REPROVADA devolve para refazer.';
comment on column public.vistorias."itemId" is
  'Qual servico da OS foi conferido. E por item porque a lavagem pode passar e a '
  'higienizacao interna reprovar — quem refaz e so quem errou.';
comment on column public.vistorias."refeitaDe" is
  'Aponta para a vistoria reprovada que originou este retrabalho, formando o historico.';

create index if not exists vistorias_item_idx on public.vistorias ("itemId");

-- ------------------------------------------------------------
-- Registrar a conferencia de limpeza
-- ------------------------------------------------------------
create or replace function public.conferir_limpeza(
  p_item_id        text,
  p_vistoriador    text,
  p_aprovada       boolean,
  p_checklist      jsonb default '{}'::jsonb,
  p_motivo         text default null,
  p_observacoes    text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item   public.os_itens%rowtype;
  v_id     text := gen_random_uuid()::text;
  v_antes  text;
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_item from public.os_itens where id = p_item_id for update;
  if not found then
    raise exception 'servico nao encontrado' using errcode = 'P0002';
  end if;
  if v_item.status = 'CANCELADO' then
    raise exception 'este servico foi cancelado' using errcode = 'P0001';
  end if;

  if not p_aprovada and coalesce(btrim(p_motivo), '') = '' then
    raise exception 'diga o que precisa ser refeito' using errcode = 'P0001';
  end if;

  -- Encadeia com a reprovacao anterior, se houver, para o historico mostrar
  -- quantas vezes o mesmo servico voltou.
  select id into v_antes
  from public.vistorias
  where "itemId" = p_item_id and tipo = 'LIMPEZA' and "resultadoLimpeza" = 'REPROVADA'
  order by data desc limit 1;

  insert into public.vistorias
    (id, tipo, "ordemId", "itemId", "funcionarioId", data, checklist, avarias, pertences,
     "resultadoLimpeza", "motivoReprovacao", observacoes, "refeitaDe", "criadoEm")
  values
    (v_id, 'LIMPEZA', v_item."ordemId", p_item_id, p_vistoriador, now(),
     coalesce(p_checklist, '{}'::jsonb), '[]'::jsonb, '[]'::jsonb,
     case when p_aprovada then 'APROVADA' else 'REPROVADA' end,
     case when p_aprovada then null else p_motivo end,
     p_observacoes, v_antes, now());

  if p_aprovada then
    update public.os_itens
    set status = 'CONCLUIDO', "concluidoEm" = coalesce("concluidoEm", now())
    where id = p_item_id;
  else
    -- Volta para quem executou. `concluidoEm` e zerado de proposito: o servico
    -- deixou de estar pronto, e deixar a data antiga faria a OS parecer no prazo.
    update public.os_itens
    set status = 'EXECUTANDO', "concluidoEm" = null
    where id = p_item_id;

    insert into public.alertas
      (id, tipo, status, titulo, descricao, "dataAlvo", "ordemId", "criadoEm")
    select gen_random_uuid()::text, 'ENTREGA_ATRASADA', 'PENDENTE',
           'Refazer: ' || v_item.descricao,
           'Reprovado na conferencia de limpeza. Motivo: ' || p_motivo,
           now(), v_item."ordemId", now();
  end if;

  perform public.ajustar_status_ordem(v_item."ordemId");
  return v_id;
end;
$$;

revoke all on function public.conferir_limpeza from public, anon;
grant execute on function public.conferir_limpeza to authenticated;
