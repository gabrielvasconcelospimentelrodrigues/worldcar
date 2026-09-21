-- Operacoes da agenda: confirmar, cancelar e transformar em OS.
--
-- Tudo aqui poderia ser um `update` pela tela, e e justamente por isso que nao
-- e. Confirmar um agendamento tambem fecha o alerta que pedia a confirmacao;
-- cancelar precisa dizer o motivo; e a chegada do cliente vira ordem de
-- servico, o que envolve casar cliente e veiculo com o cadastro. Espalhar isso
-- pelo navegador significaria repetir a regra em cada botao e esquecer um
-- pedaco em algum deles.

-- ------------------------------------------------------------
-- Confirmar
-- ------------------------------------------------------------
create or replace function public.confirmar_agendamento(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ag public.agendamentos%rowtype;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found then
    raise exception 'agendamento nao encontrado' using errcode = 'P0002';
  end if;
  if v_ag.status <> 'PENDENTE' then
    raise exception 'este agendamento ja esta %', lower(v_ag.status)
      using errcode = 'P0001';
  end if;

  update public.agendamentos
  set status = 'CONFIRMADO',
      "confirmadoEm" = now(),
      -- Confirmado nao expira mais: a reserva existia so para segurar o horario
      -- enquanto ninguem tinha decidido.
      "reservadoAte" = null,
      "atualizadoEm" = now()
  where id = p_id;

  -- Fecha o alerta que pedia esta confirmacao. Sem isso ele ficaria pendente
  -- para sempre, e a lista de alertas perderia o sentido.
  update public.alertas
  set status = 'CONCLUIDO', "concluidoEm" = now(), resultado = 'Confirmado.'
  where status = 'PENDENTE'
    and titulo like 'Confirmar agendamento #' || v_ag.numero || '%';

  return jsonb_build_object('numero', v_ag.numero, 'status', 'CONFIRMADO');
end;
$$;

-- ------------------------------------------------------------
-- Cancelar
-- ------------------------------------------------------------
create or replace function public.cancelar_agendamento(
  p_id     text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ag public.agendamentos%rowtype;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'diga o motivo do cancelamento' using errcode = 'P0001';
  end if;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found then
    raise exception 'agendamento nao encontrado' using errcode = 'P0002';
  end if;
  if v_ag.status in ('CANCELADO', 'COMPARECEU') then
    raise exception 'este agendamento ja esta encerrado' using errcode = 'P0001';
  end if;

  update public.agendamentos
  set status = 'CANCELADO',
      "canceladoEm" = now(),
      "motivoCancelamento" = btrim(p_motivo),
      "reservadoAte" = null,
      "atualizadoEm" = now()
  where id = p_id;

  update public.alertas
  set status = 'CANCELADO', "concluidoEm" = now(),
      resultado = 'Agendamento cancelado.'
  where status = 'PENDENTE'
    and titulo like 'Confirmar agendamento #' || v_ag.numero || '%';

  -- Pagamento em aberto perde a razao de existir. O estorno, quando houver, e
  -- feito no painel do provedor: um sistema de oficina nao deve poder devolver
  -- dinheiro sozinho.
  update public.pagamentos_online
  set status = 'CANCELADO', "atualizadoEm" = now()
  where "agendamentoId" = p_id and status in ('CRIADO', 'PENDENTE');

  return jsonb_build_object('numero', v_ag.numero, 'status', 'CANCELADO');
end;
$$;

-- ------------------------------------------------------------
-- Cliente chegou: vira ordem de servico
-- ------------------------------------------------------------
create or replace function public.converter_agendamento(
  p_id                   text,
  p_funcionario_entrada  text,
  p_km_entrada           int default null,
  p_combustivel          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ag      public.agendamentos%rowtype;
  v_sv      public.servicos%rowtype;
  v_cliente text;
  v_veiculo text;
  v_os      text := gen_random_uuid()::text;
  v_numero  int;
  v_novo_cliente boolean := false;
  v_novo_veiculo boolean := false;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found then
    raise exception 'agendamento nao encontrado' using errcode = 'P0002';
  end if;
  if v_ag."ordemId" is not null then
    raise exception 'este agendamento ja virou a OS %',
      (select numero from public.ordens_servico where id = v_ag."ordemId")
      using errcode = 'P0001';
  end if;
  if v_ag.status = 'CANCELADO' then
    raise exception 'este agendamento foi cancelado' using errcode = 'P0001';
  end if;

  select * into v_sv from public.servicos where id = v_ag."servicoId";

  -- --- cliente ---
  v_cliente := v_ag."clienteId";
  if v_cliente is null then
    -- Casa pelo telefone: quem marcou pelo site digitou nome e telefone, e o
    -- telefone e o que identifica a pessoa sem pedir documento.
    select id into v_cliente from public.clientes
    where regexp_replace(telefone, '\D', '', 'g') = v_ag.telefone
    limit 1;
  end if;

  if v_cliente is null then
    v_cliente := gen_random_uuid()::text;
    insert into public.clientes (id, nome, telefone, observacoes, "atualizadoEm")
    values (v_cliente, v_ag.nome, v_ag.telefone,
            'Cadastrado a partir do agendamento #' || v_ag.numero, now());
    v_novo_cliente := true;
  end if;

  -- --- veiculo ---
  v_veiculo := v_ag."veiculoId";
  if v_veiculo is null and v_ag.placa is not null then
    select id into v_veiculo from public.veiculos where placa = v_ag.placa limit 1;

    if v_veiculo is null then
      v_veiculo := gen_random_uuid()::text;
      insert into public.veiculos (id, placa, marca, modelo, "clienteId", "atualizadoEm")
      values (v_veiculo, v_ag.placa,
              -- O site pede o veiculo em texto livre; aqui vira marca e modelo
              -- do jeito que der, para o atendente corrigir depois se precisar.
              coalesce(split_part(btrim(v_ag."veiculoDesc"), ' ', 1), 'A definir'),
              coalesce(nullif(btrim(substr(coalesce(v_ag."veiculoDesc", ''),
                        length(split_part(btrim(coalesce(v_ag."veiculoDesc", '')), ' ', 1)) + 1)), ''),
                       'A definir'),
              v_cliente, now());
      v_novo_veiculo := true;
    end if;
  end if;

  if v_veiculo is null then
    raise exception 'informe a placa do veiculo antes de abrir a OS'
      using errcode = 'P0001';
  end if;

  -- --- ordem ---
  insert into public.ordens_servico
    (id, numero, status, "clienteId", "veiculoId", "dataEntrada",
     "funcionarioEntradaId", "kmEntrada", "combustivelEntrada",
     subtotal, total, observacoes, "criadoEm", "atualizadoEm")
  values
    (v_os, nextval('public.ordens_servico_numero_seq'), 'AGUARDANDO',
     v_cliente, v_veiculo, now(), p_funcionario_entrada, p_km_entrada, p_combustivel,
     0, 0,
     'Agendamento #' || v_ag.numero ||
       coalesce(' — ' || v_ag.observacoes, ''), now(), now())
  returning numero into v_numero;

  insert into public.os_itens
    (id, "ordemId", "servicoId", descricao, quantidade, "precoUnit", desconto,
     total, status, "garantiaDias")
  values
    (gen_random_uuid()::text, v_os, v_sv.id, v_sv.nome, 1, v_sv.preco, 0,
     v_sv.preco, 'PENDENTE', coalesce(v_sv."garantiaDias", 0));

  perform public.recalcular_ordem(v_os);

  -- O que ja foi pago no agendamento entra como sinal da OS, senao o cliente
  -- pagaria duas vezes pelo mesmo servico.
  insert into public.lancamentos
    (id, tipo, status, descricao, valor, vencimento, pagamento, "categoriaId",
     "ordemId", observacoes, "criadoEm", "atualizadoEm")
  select gen_random_uuid()::text, 'RECEITA', 'PAGO',
         'Sinal pago no agendamento #' || v_ag.numero,
         p.valor, p."pagoEm", p."pagoEm",
         (select id from public.categorias_financeiras
          where tipo = 'RECEITA' and nome = 'Servicos' limit 1),
         v_os, 'Recebido por ' || p.provedor, now(), now()
  from public.pagamentos_online p
  where p."agendamentoId" = p_id and p.status = 'PAGO';

  update public.agendamentos
  set status = 'COMPARECEU',
      "ordemId" = v_os,
      "clienteId" = v_cliente,
      "veiculoId" = v_veiculo,
      "atualizadoEm" = now()
  where id = p_id;

  update public.pagamentos_online set "ordemId" = v_os where "agendamentoId" = p_id;

  return jsonb_build_object(
    'ordemId', v_os,
    'numero', v_numero,
    'clienteNovo', v_novo_cliente,
    'veiculoNovo', v_novo_veiculo
  );
end;
$$;

revoke all on function public.confirmar_agendamento(text) from public, anon;
revoke all on function public.cancelar_agendamento(text, text) from public, anon;
revoke all on function public.converter_agendamento(text, text, int, text) from public, anon;
grant execute on function public.confirmar_agendamento(text) to authenticated;
grant execute on function public.cancelar_agendamento(text, text) to authenticated;
grant execute on function public.converter_agendamento(text, text, int, text) to authenticated;
