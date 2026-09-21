-- Pagamento dos servicos.
--
-- Tres buracos que existiam:
--
-- 1. Todo recebimento nascia PENDENTE, mesmo quando o cliente pagava no PIX ali
--    no balcao. O atendente entregava o carro e precisava lembrar de ir ao
--    financeiro dar baixa — e quando esquecia, a OS aparecia como inadimplente.
--
-- 2. Nao havia como registrar SINAL. Funilaria trabalha com entrada de 50%, e
--    esse dinheiro entrava na oficina sem passar pelo sistema.
--
-- 3. A divisao em parcelas perdia centavos: `round(total / parcelas, 2)` gera
--    3x R$ 33,33 para R$ 100,00, somando R$ 99,99. Medido tambem ao contrario —
--    R$ 99,99 em 2x virava 2x R$ 50,00, cobrando um centavo A MAIS do cliente.
--
-- A escolha de projeto: nao criar tabela de pagamentos. O `lancamentos` ja e o
-- livro-caixa da empresa; um recebimento e uma linha PAGA ali, ligada a OS.
-- Duas fontes de verdade para o mesmo dinheiro so dariam divergencia.

-- ------------------------------------------------------------
-- Quanto uma OS ja recebeu e quanto falta
-- ------------------------------------------------------------
create or replace function public.saldo_ordem(p_ordem_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'total',    coalesce(o.total, 0),
    'pago',     coalesce(p.pago, 0),
    'em_aberto', coalesce(a.aberto, 0),
    'saldo',    coalesce(o.total, 0) - coalesce(p.pago, 0)
  )
  from public.ordens_servico o
  left join lateral (
    select sum(valor) pago from public.lancamentos
    where "ordemId" = o.id and tipo = 'RECEITA' and status = 'PAGO'
  ) p on true
  left join lateral (
    select sum(valor) aberto from public.lancamentos
    where "ordemId" = o.id and tipo = 'RECEITA' and status in ('PENDENTE','ATRASADO')
  ) a on true
  where o.id = p_ordem_id and public.eh_equipe();
$$;

-- ------------------------------------------------------------
-- Registrar um recebimento (sinal ou pagamento)
-- ------------------------------------------------------------
create or replace function public.registrar_pagamento(
  p_ordem_id   text,
  p_valor      numeric,
  p_forma      public."FormaPagamento",
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ordem     public.ordens_servico%rowtype;
  v_pago      numeric(10,2);
  v_categoria text;
  v_rotulo    text;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if coalesce(p_valor, 0) <= 0 then
    raise exception 'o valor precisa ser maior que zero' using errcode = 'P0001';
  end if;

  select * into v_ordem from public.ordens_servico where id = p_ordem_id for update;
  if not found then
    raise exception 'ordem de servico nao encontrada' using errcode = 'P0002';
  end if;
  if v_ordem.status = 'CANCELADA' then
    raise exception 'esta OS esta cancelada' using errcode = 'P0001';
  end if;

  select coalesce(sum(valor), 0) into v_pago
  from public.lancamentos
  where "ordemId" = p_ordem_id and tipo = 'RECEITA' and status = 'PAGO';

  -- Recebimento acima do total costuma ser digito trocado. Barrar aqui evita
  -- uma receita inflada que so apareceria no fechamento do mes.
  if v_ordem.total > 0 and v_pago + p_valor > v_ordem.total + 0.01 then
    raise exception 'valor acima do saldo: a OS soma % e ja recebeu %',
      v_ordem.total, v_pago using errcode = 'P0001';
  end if;

  select id into v_categoria from public.categorias_financeiras
  where tipo = 'RECEITA' and nome = 'Servicos' limit 1;

  -- Antes da entrega e sinal; depois, pagamento.
  v_rotulo := case when v_ordem.status = 'ENTREGUE' then 'Pagamento' else 'Sinal' end;

  insert into public.lancamentos
    (id, tipo, status, descricao, valor, vencimento, pagamento, forma,
     "categoriaId", "ordemId", observacoes, "criadoEm", "atualizadoEm")
  select gen_random_uuid()::text, 'RECEITA', 'PAGO',
    v_rotulo || ' OS ' || v_ordem.numero || ' - ' || c.nome || ' (' || v.placa || ')',
    p_valor, now(), now(), p_forma, v_categoria, p_ordem_id, p_observacao, now(), now()
  from public.clientes c, public.veiculos v
  where c.id = v_ordem."clienteId" and v.id = v_ordem."veiculoId";

  return public.saldo_ordem(p_ordem_id);
end;
$$;

-- ------------------------------------------------------------
-- Entrega: recebimento na hora, sinal abatido e parcela sem centavo perdido
-- ------------------------------------------------------------
--
-- Acrescentar um parametro NAO substitui a funcao: o Postgres identifica pela
-- assinatura e criaria uma sobrecarga, deixando as duas no banco. A versao
-- antiga continuaria sendo escolhida nas chamadas com nove argumentos, e o
-- pagamento no ato nunca funcionaria. Por isso a antiga cai primeiro.
drop function if exists public.entregar_ordem(
  text, text, text, int, text, text, public."FormaPagamento", int, text);

create or replace function public.entregar_ordem(
  p_ordem_id            text,
  p_funcionario_saida   text,
  p_cliente_retirou     text,
  p_km_saida            int default null,
  p_documento_retirada  text default null,
  p_observacoes_saida   text default null,
  p_forma_pagamento     public."FormaPagamento" default null,
  p_parcelas            int default 1,
  p_assinatura_entrega  text default null,
  -- Novo: o cliente pagou agora, no balcao. Sem isto tudo nascia PENDENTE e
  -- dependia de alguem lembrar de dar baixa depois.
  p_pago_agora          boolean default false
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
  v_ja_pago      numeric(10,2);
  v_restante     numeric(10,2);
  v_base         numeric(10,2);
  v_valor        numeric(10,2);
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
  -- O sinal ja recebido entra na conta: quem pagou 50% adiantado nao pode ver
  -- o valor cheio voltando como cobranca na entrega.
  select coalesce(sum(valor), 0) into v_ja_pago
  from public.lancamentos
  where "ordemId" = p_ordem_id and tipo = 'RECEITA' and status = 'PAGO';

  v_restante := v_ordem.total - v_ja_pago;

  if v_restante > 0.005
     and not exists (select 1 from public.lancamentos
                     where "ordemId" = p_ordem_id and tipo = 'RECEITA'
                       and status in ('PENDENTE','ATRASADO')) then
    select id into v_categoria from public.categorias_financeiras
      where tipo = 'RECEITA' and nome = 'Servicos' limit 1;

    -- Divisao sem perder centavo: todas as parcelas levam o valor arredondado
    -- para baixo e a ULTIMA absorve a diferenca. R$ 100 em 3x vira 33,33 +
    -- 33,33 + 33,34, somando exatamente R$ 100,00.
    v_base := trunc(v_restante / v_parcelas, 2);

    for i in 1..v_parcelas loop
      v_valor := case when i = v_parcelas
                   then v_restante - (v_base * (v_parcelas - 1))
                   else v_base end;

      insert into public.lancamentos
        (id, tipo, status, descricao, valor, vencimento, pagamento, forma,
         "categoriaId", "ordemId", parcela, "totalParcelas", "criadoEm", "atualizadoEm")
      select
        gen_random_uuid()::text,
        'RECEITA',
        -- Pagamento no ato so vale para a primeira parcela: quem parcelou no
        -- cartao nao quitou as outras hoje.
        --
        -- O cast e obrigatorio: um literal solto o Postgres converte para o
        -- enum sozinho, mas o resultado de um CASE chega como text e a
        -- insercao falha.
        (case when p_pago_agora and i = 1 then 'PAGO' else 'PENDENTE' end)::public."StatusLancamento",
        'OS ' || v_ordem.numero || ' - ' || c.nome || ' (' || v.placa || ')',
        v_valor,
        now() + ((i - 1) * interval '30 days'),
        case when p_pago_agora and i = 1 then now() else null end,
        p_forma_pagamento, v_categoria, p_ordem_id,
        case when v_parcelas > 1 then i end,
        case when v_parcelas > 1 then v_parcelas end,
        now(), now()
      from public.clientes c, public.veiculos v
      where c.id = v_ordem."clienteId" and v.id = v_ordem."veiculoId";
    end loop;
  end if;

  -- --- comissoes ---
  select coalesce(sum(total), 0) into v_soma_itens
  from public.os_itens
  where "ordemId" = p_ordem_id and status = 'CONCLUIDO';

  v_proporcao := case when v_soma_itens > 0
    then least(1, v_ordem.total / v_soma_itens) else 1 end;

  v_referencia := to_char(now(), 'YYYY-MM');

  for r in
    select i."responsavelId" func, sum(i.total) base, f."comissaoPct" pct
    from public.os_itens i
    join public.funcionarios f on f.id = i."responsavelId"
    where i."ordemId" = p_ordem_id and i.status = 'CONCLUIDO'
      and coalesce(f."comissaoPct", 0) > 0
    group by i."responsavelId", f."comissaoPct"
  loop
    insert into public.comissoes
      (id, "funcionarioId", "ordemId", "baseCalculo", percentual, valor, referencia, "criadoEm")
    values
      (gen_random_uuid()::text, r.func, p_ordem_id,
       round(r.base * v_proporcao, 2), r.pct,
       round(r.base * v_proporcao * r.pct / 100, 2), v_referencia, now());
    v_comissoes := v_comissoes + 1;
  end loop;

  -- --- alertas de retorno ---
  select v.marca || ' ' || v.modelo || ' ' || v.placa into v_veiculo
  from public.veiculos v where v.id = v_ordem."veiculoId";

  for r in
    select distinct i.descricao, i."garantiaDias"
    from public.os_itens i
    where i."ordemId" = p_ordem_id and i.status = 'CONCLUIDO'
      and coalesce(i."garantiaDias", 0) > 0
  loop
    insert into public.alertas
      (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "veiculoId",
       "ordemId", "criadoEm")
    values
      (gen_random_uuid()::text, 'RETORNO_GARANTIA', 'PENDENTE',
       'Fim de garantia - ' || v_veiculo,
       'Garantia de ' || r.descricao || ' vence nesta data.',
       now() + (r."garantiaDias" * interval '1 day'),
       v_ordem."clienteId", v_ordem."veiculoId", p_ordem_id, now());
    v_alertas := v_alertas + 1;
  end loop;

  return jsonb_build_object(
    'comissoes_geradas', v_comissoes,
    'alertas_gerados', v_alertas,
    'parcelas', v_parcelas,
    'ja_pago', v_ja_pago,
    'a_receber', greatest(0, v_restante)
  );
end;
$$;

revoke all on function public.saldo_ordem(text) from public, anon;
revoke all on function public.registrar_pagamento(
  text, numeric, public."FormaPagamento", text) from public, anon;
revoke all on function public.entregar_ordem(
  text, text, text, int, text, text, public."FormaPagamento", int, text, boolean)
  from public, anon;

grant execute on function public.saldo_ordem(text) to authenticated;
grant execute on function public.registrar_pagamento(
  text, numeric, public."FormaPagamento", text) to authenticated;
grant execute on function public.entregar_ordem(
  text, text, text, int, text, text, public."FormaPagamento", int, text, boolean)
  to authenticated;
