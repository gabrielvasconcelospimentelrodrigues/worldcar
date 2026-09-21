-- Pontos viram desconto de verdade, e o cliente fica sabendo que tem pontos.
--
-- Como estava: `resgatar_pontos` debitava o saldo e devolvia um valor em reais
-- para o atendente digitar como desconto. Meio caminho — se ele esquecesse, o
-- cliente perdia os pontos sem receber nada, e nada no sistema acusaria.
--
-- Agora o resgate lanca o desconto na propria OS.
--
-- Coluna separada, e nao somada ao `desconto` existente: aquele campo guarda ou
-- um valor ou um percentual, conforme `descontoTipo`. Empurrar reais de pontos
-- ali dentro quebraria o desconto percentual negociado com o cliente — e quem
-- tem acordo de 10% e ainda resgata pontos merece os dois.

alter table public.ordens_servico
  add column if not exists "descontoPontos" numeric(10,2) not null default 0;

comment on column public.ordens_servico."descontoPontos" is
  'Abatimento vindo de resgate de pontos. Somado ao desconto comum no total.';

-- ------------------------------------------------------------
-- Recalculo ciente dos dois descontos
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
  v_pontos   numeric(10,2);
  v_abatido  numeric(10,2);
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select coalesce(sum(total), 0) into v_subtotal
  from public.os_itens
  where "ordemId" = p_ordem_id and status <> 'CANCELADO';

  select desconto, "descontoTipo", coalesce("descontoPontos", 0)
    into v_desconto, v_tipo, v_pontos
  from public.ordens_servico where id = p_ordem_id;

  v_abatido := case
    when v_tipo = 'PERCENTUAL'
      then round(v_subtotal * least(greatest(coalesce(v_desconto, 0), 0), 100) / 100, 2)
    else greatest(coalesce(v_desconto, 0), 0)
  end;

  update public.ordens_servico
  set subtotal = v_subtotal,
      total = greatest(0, v_subtotal - v_abatido - v_pontos)
  where id = p_ordem_id;
end;
$$;

-- ------------------------------------------------------------
-- Resgate aplicado na ordem
-- ------------------------------------------------------------
create or replace function public.resgatar_pontos(
  p_cliente_id text,
  p_pontos     int,
  p_ordem_id   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par    public.parametros_fidelidade%rowtype;
  v_saldo  int;
  v_valor  numeric(10,2);
  v_ordem  public.ordens_servico%rowtype;
begin
  if not public.eh_atendimento() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_par from public.parametros_fidelidade where id = 'default';
  if not v_par.ativo then
    raise exception 'o programa de fidelidade esta desativado' using errcode = 'P0001';
  end if;
  if p_pontos <= 0 then
    raise exception 'informe quantos pontos resgatar' using errcode = 'P0001';
  end if;
  if p_pontos < v_par."minimoResgate" then
    raise exception 'o resgate minimo e de % pontos', v_par."minimoResgate"
      using errcode = 'P0001';
  end if;

  select coalesce(sum(pontos), 0) into v_saldo
  from public.fidelidade_movimentos
  where "clienteId" = p_cliente_id and ("expiraEm" is null or "expiraEm" > now());

  if p_pontos > v_saldo then
    raise exception 'saldo insuficiente: o cliente tem % ponto(s)', v_saldo
      using errcode = 'P0001';
  end if;

  v_valor := round(p_pontos * v_par."valorDoPonto", 2);

  if p_ordem_id is not null then
    select * into v_ordem from public.ordens_servico where id = p_ordem_id for update;
    if not found then
      raise exception 'ordem de servico nao encontrada' using errcode = 'P0002';
    end if;
    if v_ordem.status in ('ENTREGUE','CANCELADA') then
      raise exception 'esta OS ja foi encerrada; nao da para aplicar desconto'
        using errcode = 'P0001';
    end if;
    if v_ordem."clienteId" <> p_cliente_id then
      raise exception 'esta OS e de outro cliente' using errcode = 'P0001';
    end if;

    -- Nao deixa o desconto passar do que ainda ha para cobrar: resgatar mais do
    -- que a conta zeraria o total e queimaria pontos a toa.
    if v_valor > v_ordem.total then
      raise exception 'o desconto de % excede o total da OS, que e de %',
        v_valor, v_ordem.total using errcode = 'P0001';
    end if;

    update public.ordens_servico
    set "descontoPontos" = coalesce("descontoPontos", 0) + v_valor,
        "atualizadoEm" = now()
    where id = p_ordem_id;

    perform public.recalcular_ordem(p_ordem_id);
  end if;

  insert into public.fidelidade_movimentos
    (id, "clienteId", "ordemId", tipo, pontos, "valorBase", descricao, "criadoEm")
  values
    (gen_random_uuid()::text, p_cliente_id, p_ordem_id, 'RESGATE',
     -p_pontos, v_valor,
     case when p_ordem_id is null
       then 'Resgate de ' || p_pontos || ' pontos'
       else 'Desconto de ' || p_pontos || ' pontos na OS '
            || coalesce(v_ordem.numero::text, '?') end,
     now());

  return jsonb_build_object(
    'pontos', p_pontos,
    'valor', v_valor,
    'saldo_restante', v_saldo - p_pontos,
    'aplicado_na_os', p_ordem_id is not null,
    'novo_total', case when p_ordem_id is not null
      then (select total from public.ordens_servico where id = p_ordem_id) end
  );
end;
$$;

-- ------------------------------------------------------------
-- Alertas da fidelidade
-- ------------------------------------------------------------
-- Duas perguntas que o cliente nao tem como responder sozinho: quantos pontos
-- ele tem, e quando eles vencem. Quem avisa e a oficina — e so avisa se o
-- sistema lembrar. Sem isto o programa vira uma promessa que ninguem cumpre, o
-- que e pior do que nao ter programa.
create or replace function public.alertas_fidelidade()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par       public.parametros_fidelidade%rowtype;
  v_vencendo  int := 0;
begin
  if not public.eh_equipe() then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into v_par from public.parametros_fidelidade where id = 'default';
  if not found or not v_par.ativo then
    return jsonb_build_object('vencendo', 0);
  end if;

  -- 1) Pontos vencendo em 30 dias.
  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "clienteId", "criadoEm")
  select gen_random_uuid()::text, 'POS_VENDA', 'PENDENTE',
         'Pontos vencendo — ' || c.nome,
         'O cliente tem ' || sum(m.pontos) || ' ponto(s) vencendo ate '
           || to_char(min(m."expiraEm"), 'DD/MM/YYYY') || ', equivalentes a R$ '
           || translate(to_char(sum(m.pontos) * v_par."valorDoPonto",
                                'FM999,999,990.00'), ',.', '.,')
           || ' de desconto. Vale avisar e trazer o carro.',
         min(m."expiraEm"), c.id, now()
  from public.fidelidade_movimentos m
  join public.clientes c on c.id = m."clienteId"
  where m.pontos > 0 and m."expiraEm" between now() and now() + interval '30 days'
    and not exists (
      select 1 from public.alertas a
      where a."clienteId" = c.id and a.status = 'PENDENTE'
        and a.titulo like 'Pontos vencendo%')
  group by c.id, c.nome
  having sum(m.pontos) >= v_par."minimoResgate";
  get diagnostics v_vencendo = row_count;

  -- Nao existe alerta de "tem saldo para resgatar", e a ausencia e deliberada.
  -- Avisar sobre todo cliente com pontos de uma vez gera centenas de linhas no
  -- mesmo dia — na primeira execucao foram 244, e a lista de alertas, que serve
  -- para o que precisa de acao HOJE, virou ilegivel. Isso e campanha, nao
  -- alerta: quem tem saldo aparece na tela de fidelidade, onde da para filtrar
  -- e trabalhar a lista com calma. Aqui fica so o que tem prazo.

  return jsonb_build_object('vencendo', v_vencendo);
end;
$$;

revoke all on function public.recalcular_ordem(text)                  from public, anon;
revoke all on function public.resgatar_pontos(text, int, text)        from public, anon;
revoke all on function public.alertas_fidelidade()                    from public, anon;
grant execute on function public.recalcular_ordem(text)               to authenticated;
grant execute on function public.resgatar_pontos(text, int, text)     to authenticated;
grant execute on function public.alertas_fidelidade()                 to authenticated;
