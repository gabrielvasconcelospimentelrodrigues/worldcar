-- ============================================================
-- World Car Service — 003: regras de negocio no banco
--
-- Estas eram as funcoes de src/lib/negocio.ts. Num SPA elas rodariam no
-- navegador do funcionario, onde o console do F12 alcanca tudo — quem calcula
-- a propria comissao pode alterar o calculo. Vivendo aqui, o navegador so pede
-- "entregue a OS 42"; quanto isso gera de receita e de comissao e decidido pelo
-- banco.
--
-- SECURITY DEFINER: rodam com privilegio proprio, por isso conferem o papel de
-- quem chamou logo na primeira linha.
-- ============================================================

-- ------------------------------------------------------------
-- Recalcula os totais da OS a partir dos itens
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
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(sum(total), 0) into v_subtotal
  from public.os_itens
  where "ordemId" = p_ordem_id and status <> 'CANCELADO';

  select desconto into v_desconto
  from public.ordens_servico where id = p_ordem_id;

  update public.ordens_servico
  set subtotal = v_subtotal,
      total = greatest(0, v_subtotal - coalesce(v_desconto, 0))
  where id = p_ordem_id;
end;
$$;

-- ------------------------------------------------------------
-- Status da OS acompanhando os itens
-- (mesma regra corrigida no sistema anterior)
-- ------------------------------------------------------------
create or replace function public.ajustar_status_ordem(p_ordem_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status public."StatusOS";
  v_ativos int;
  v_concluidos int;
  v_encostou boolean;
  v_novo public."StatusOS";
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select status into v_status from public.ordens_servico where id = p_ordem_id;
  if v_status not in ('AGUARDANDO','EM_ANDAMENTO','PRONTA') then
    return;
  end if;

  select count(*) filter (where status <> 'CANCELADO'),
         count(*) filter (where status = 'CONCLUIDO'),
         bool_or(status in ('EXECUTANDO','CONCLUIDO'))
    into v_ativos, v_concluidos, v_encostou
  from public.os_itens where "ordemId" = p_ordem_id;

  v_novo := case
    when v_ativos > 0 and v_concluidos = v_ativos then 'PRONTA'
    when coalesce(v_encostou, false) then 'EM_ANDAMENTO'
    else 'AGUARDANDO'
  end;

  if v_novo <> v_status then
    update public.ordens_servico set status = v_novo where id = p_ordem_id;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Entrega do veiculo: o coracao do sistema
--
-- Faz tudo numa transacao so: valida, registra a saida, lanca a receita,
-- calcula as comissoes e cria os alertas de garantia e pos-venda.
-- ------------------------------------------------------------
create or replace function public.entregar_ordem(
  p_ordem_id            text,
  p_funcionario_saida   text,
  p_cliente_retirou     text,
  p_km_saida            int default null,
  p_documento_retirada  text default null,
  p_observacoes_saida   text default null,
  p_forma_pagamento     public."FormaPagamento" default null,
  p_parcelas            int default 1,
  p_assinatura_entrega  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ordem        public.ordens_servico%rowtype;
  v_pendentes    int;
  v_tem_vistoria boolean;
  v_soma_itens   numeric(10,2);
  v_proporcao    numeric;
  v_categoria    text;
  v_parcelas     int := greatest(1, coalesce(p_parcelas, 1));
  v_referencia   text;
  v_veiculo      text;
  v_comissoes    int := 0;
  v_alertas      int := 0;
  r              record;
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_ordem from public.ordens_servico where id = p_ordem_id for update;
  if not found then
    raise exception 'ordem de servico nao encontrada' using errcode = 'P0002';
  end if;
  if v_ordem.status = 'ENTREGUE' then
    raise exception 'esta OS ja foi entregue' using errcode = 'P0001';
  end if;
  if v_ordem.status = 'CANCELADA' then
    raise exception 'esta OS esta cancelada' using errcode = 'P0001';
  end if;

  -- As mesmas duas travas do sistema anterior
  select count(*) into v_pendentes
  from public.os_itens
  where "ordemId" = p_ordem_id and status not in ('CONCLUIDO','CANCELADO');
  if v_pendentes > 0 then
    raise exception 'ainda ha % servico(s) nao concluido(s)', v_pendentes
      using errcode = 'P0001';
  end if;

  select exists(select 1 from public.vistorias where "ordemId" = p_ordem_id and tipo = 'SAIDA')
    into v_tem_vistoria;
  if not v_tem_vistoria then
    raise exception 'registre a vistoria de saida antes de entregar o veiculo'
      using errcode = 'P0001';
  end if;

  -- --- registra a saida ---
  update public.ordens_servico set
    status = 'ENTREGUE',
    "dataSaida" = now(),
    "funcionarioSaidaId" = p_funcionario_saida,
    "kmSaida" = p_km_saida,
    "clienteRetirou" = p_cliente_retirou,
    "documentoRetirada" = p_documento_retirada,
    "observacoesSaida" = p_observacoes_saida,
    "assinaturaEntrega" = case
      when p_assinatura_entrega like 'data:image%' then p_assinatura_entrega else null end
  where id = p_ordem_id;

  if p_km_saida is not null and p_km_saida > 0 then
    update public.veiculos set km = p_km_saida where id = v_ordem."veiculoId";
  end if;

  -- --- receita ---
  if not exists (select 1 from public.lancamentos where "ordemId" = p_ordem_id)
     and v_ordem.total > 0 then
    select id into v_categoria from public.categorias_financeiras
      where tipo = 'RECEITA' and nome = 'Servicos' limit 1;

    insert into public.lancamentos
      (id, tipo, status, descricao, valor, vencimento, forma, "categoriaId",
       "ordemId", parcela, "totalParcelas", "criadoEm", "atualizadoEm")
    select
      gen_random_uuid()::text,
      'RECEITA', 'PENDENTE',
      'OS ' || v_ordem.numero || ' - ' || c.nome || ' (' || v.placa || ')',
      round(v_ordem.total / v_parcelas, 2),
      now() + ((i - 1) * interval '30 days'),
      p_forma_pagamento, v_categoria, p_ordem_id,
      case when v_parcelas > 1 then i end,
      case when v_parcelas > 1 then v_parcelas end,
      now(), now()
    from generate_series(1, v_parcelas) i
    cross join public.clientes c
    cross join public.veiculos v
    where c.id = v_ordem."clienteId" and v.id = v_ordem."veiculoId";
  end if;

  -- --- comissoes ---
  -- O desconto do documento e rateado entre os itens: a comissao incide sobre
  -- o que a loja recebeu, nao sobre o valor cheio.
  delete from public.comissoes where "ordemId" = p_ordem_id and pago = false;

  select coalesce(sum(total), 0) into v_soma_itens
  from public.os_itens where "ordemId" = p_ordem_id and status <> 'CANCELADO';

  v_proporcao := case when v_soma_itens > 0
    then least(1, v_ordem.total / v_soma_itens) else 1 end;
  v_referencia := to_char(coalesce(v_ordem."dataSaida", now()), 'YYYY-MM');

  for r in
    select i."responsavelId" as func_id,
           coalesce(nullif(s."comissaoPct", 0), f."comissaoPct", 0) as pct,
           sum(i.total) as base
    from public.os_itens i
    left join public.servicos s on s.id = i."servicoId"
    left join public."funcionarios" f on f.id = i."responsavelId"
    where i."ordemId" = p_ordem_id
      and i.status = 'CONCLUIDO'
      and i."responsavelId" is not null
    group by i."responsavelId", s."comissaoPct", f."comissaoPct"
    having coalesce(nullif(s."comissaoPct", 0), f."comissaoPct", 0) > 0
  loop
    insert into public.comissoes
      (id, "funcionarioId", "ordemId", "baseCalculo", percentual, valor, referencia, "criadoEm")
    values
      (gen_random_uuid()::text, r.func_id, p_ordem_id,
       round(r.base * v_proporcao, 2), r.pct,
       round(r.base * v_proporcao * r.pct / 100, 2), v_referencia, now());
    v_comissoes := v_comissoes + 1;
  end loop;

  -- --- alertas ---
  update public.alertas set status = 'CANCELADO'
  where "ordemId" = p_ordem_id and tipo = 'ENTREGA_ATRASADA' and status = 'PENDENTE';

  delete from public.alertas
  where "ordemId" = p_ordem_id and status = 'PENDENTE'
    and tipo in ('POS_VENDA','RETORNO_GARANTIA');

  select v.marca || ' ' || v.modelo || ' (' || v.placa || ')' into v_veiculo
  from public.veiculos v where v.id = v_ordem."veiculoId";

  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId", "ordemId", "criadoEm")
  select gen_random_uuid()::text, 'POS_VENDA', 'PENDENTE',
         'Pos-venda: ' || c.nome,
         'Confirmar satisfacao com o servico da OS ' || v_ordem.numero || ' - ' || v_veiculo,
         now() + interval '3 days',
         v_ordem."clienteId", v_ordem."veiculoId", p_ordem_id, now()
  from public.clientes c where c.id = v_ordem."clienteId";
  v_alertas := v_alertas + 1;

  -- Um retorno por prazo de garantia distinto, agrupando os servicos
  for r in
    select i."garantiaDias" as dias, string_agg(i.descricao, ', ') as servicos
    from public.os_itens i
    where i."ordemId" = p_ordem_id and i.status = 'CONCLUIDO' and i."garantiaDias" > 0
    group by i."garantiaDias"
  loop
    insert into public.alertas
      (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId", "ordemId", "criadoEm")
    select gen_random_uuid()::text, 'RETORNO_GARANTIA', 'PENDENTE',
           'Retorno de garantia (' || r.dias || ' dias): ' || c.nome,
           v_veiculo || ' - ' || r.servicos || '. Agendar revisao antes do fim da garantia.',
           coalesce(v_ordem."dataSaida", now()) + (r.dias * interval '1 day'),
           v_ordem."clienteId", v_ordem."veiculoId", p_ordem_id, now()
    from public.clientes c where c.id = v_ordem."clienteId";
    v_alertas := v_alertas + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'comissoes_geradas', v_comissoes,
    'alertas_gerados', v_alertas,
    'parcelas', v_parcelas
  );
end;
$$;

-- ------------------------------------------------------------
-- Converte orcamento aprovado em OS
-- ------------------------------------------------------------
create or replace function public.converter_orcamento(
  p_orcamento_id       text,
  p_funcionario_entrada text,
  p_km_entrada         int default null,
  p_combustivel        text default null,
  p_previsao           timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_orc   public.orcamentos%rowtype;
  v_id    text := gen_random_uuid()::text;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_orc from public.orcamentos where id = p_orcamento_id for update;
  if not found then
    raise exception 'orcamento nao encontrado' using errcode = 'P0002';
  end if;
  if v_orc.status = 'CONVERTIDO' then
    raise exception 'este orcamento ja virou OS' using errcode = 'P0001';
  end if;

  insert into public.ordens_servico
    (id, numero, status, "orcamentoId", "clienteId", "veiculoId", "dataEntrada",
     "funcionarioEntradaId", "kmEntrada", "combustivelEntrada", "previsaoEntrega",
     subtotal, desconto, total, observacoes, "criadoEm", "atualizadoEm")
  values
    (v_id, nextval('public.ordens_servico_numero_seq'), 'AGUARDANDO', p_orcamento_id,
     v_orc."clienteId", v_orc."veiculoId", now(), p_funcionario_entrada,
     p_km_entrada, p_combustivel, p_previsao,
     v_orc.subtotal, v_orc.desconto, v_orc.total, v_orc.observacoes, now(), now());

  insert into public.os_itens
    (id, "ordemId", "servicoId", descricao, quantidade, "precoUnit", desconto,
     total, status, "garantiaDias")
  select gen_random_uuid()::text, v_id, i."servicoId", i.descricao, i.quantidade,
         i."precoUnit", i.desconto, i.total, 'PENDENTE',
         coalesce(s."garantiaDias", 0)
  from public.orcamento_itens i
  left join public.servicos s on s.id = i."servicoId"
  where i."orcamentoId" = p_orcamento_id
  order by i.ordem;

  update public.orcamentos
  set status = 'CONVERTIDO', "aprovadoEm" = coalesce("aprovadoEm", now())
  where id = p_orcamento_id;

  if p_km_entrada is not null and p_km_entrada > 0 then
    update public.veiculos set km = p_km_entrada where id = v_orc."veiculoId";
  end if;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- Varredura de pendencias
--
-- Antes isso rodava a cada abertura do painel, fazendo duas escritas por
-- visita. Agora e uma chamada explicita, para ser agendada (pg_cron) ou
-- disparada no maximo uma vez por dia pela interface.
-- ------------------------------------------------------------
create or replace function public.sincronizar_pendencias()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expirados int;
  v_atrasados int;
  v_novos     int := 0;
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  update public.orcamentos set status = 'EXPIRADO'
  where status in ('RASCUNHO','ENVIADO') and "validoAte" < now();
  get diagnostics v_expirados = row_count;

  update public.lancamentos set status = 'ATRASADO'
  where status = 'PENDENTE' and vencimento < now();
  get diagnostics v_atrasados = row_count;

  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId", "ordemId", "criadoEm")
  select gen_random_uuid()::text, 'ENTREGA_ATRASADA', 'PENDENTE',
         'OS ' || o.numero || ' atrasada: ' || c.nome,
         v.marca || ' ' || v.modelo || ' (' || v.placa || ') passou da previsao de entrega.',
         o."previsaoEntrega", o."clienteId", o."veiculoId", o.id, now()
  from public.ordens_servico o
  join public.clientes c on c.id = o."clienteId"
  join public.veiculos v on v.id = o."veiculoId"
  where o.status in ('AGUARDANDO','EM_ANDAMENTO','PAUSADA')
    and o."previsaoEntrega" < now()
    and not exists (
      select 1 from public.alertas a
      where a."ordemId" = o.id and a.tipo = 'ENTREGA_ATRASADA' and a.status = 'PENDENTE');
  get diagnostics v_novos = row_count;

  return jsonb_build_object(
    'orcamentos_expirados', v_expirados,
    'lancamentos_atrasados', v_atrasados,
    'alertas_criados', v_novos
  );
end;
$$;

-- ------------------------------------------------------------
-- Painel numa consulta so
--
-- No sistema anterior o painel disparava 9 consultas de ~90 ms cada. Aqui o
-- banco monta tudo de uma vez e devolve um objeto — uma ida so.
-- ------------------------------------------------------------
create or replace function public.resumo_painel()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'os_ativas', (select count(*) from public.ordens_servico
                   where status in ('AGUARDANDO','EM_ANDAMENTO','PAUSADA')),
    'os_prontas', (select count(*) from public.ordens_servico where status = 'PRONTA'),
    'orcamentos_abertos', (select count(*) from public.orcamentos
                             where status in ('RASCUNHO','ENVIADO')),
    'alertas_hoje', (select count(*) from public.alertas
                       where status = 'PENDENTE' and "dataAlvo" <= date_trunc('day', now()) + interval '1 day'),
    'receita_mes', (select coalesce(sum(valor), 0) from public.lancamentos
                      where tipo = 'RECEITA' and status = 'PAGO'
                        and pagamento >= date_trunc('month', now())),
    'despesa_mes', (select coalesce(sum(valor), 0) from public.lancamentos
                      where tipo = 'DESPESA' and status = 'PAGO'
                        and pagamento >= date_trunc('month', now())),
    'a_receber', (select coalesce(sum(valor), 0) from public.lancamentos
                    where tipo = 'RECEITA' and status in ('PENDENTE','ATRASADO'))
  )
  where public.eh_equipe();
$$;

-- Apenas quem esta logado pode chamar
revoke all on function public.entregar_ordem from public, anon;
revoke all on function public.converter_orcamento from public, anon;
revoke all on function public.sincronizar_pendencias from public, anon;
revoke all on function public.resumo_painel from public, anon;
revoke all on function public.recalcular_ordem from public, anon;
revoke all on function public.ajustar_status_ordem from public, anon;

grant execute on function public.entregar_ordem to authenticated;
grant execute on function public.converter_orcamento to authenticated;
grant execute on function public.sincronizar_pendencias to authenticated;
grant execute on function public.resumo_painel to authenticated;
grant execute on function public.recalcular_ordem to authenticated;
grant execute on function public.ajustar_status_ordem to authenticated;
