-- Corrige o elo entre a notificacao e a cobranca.
--
-- A versao anterior procurava por `referenciaExterna`, onde guardamos o id da
-- PREFERENCIA do Mercado Pago. Mas a notificacao traz o id do PAGAMENTO — outro
-- numero. A busca nunca encontraria nada, e todo pagamento aprovado seria
-- ignorado em silencio.
--
-- O elo certo e o nosso proprio id, que enviamos ao provedor no campo
-- `external_reference` e volta intacto na notificacao.
-- A assinatura antiga sai ANTES: `create or replace` nao renomeia parametro, e
-- deixar as duas conviverem seria convite para chamar a errada — a que procura
-- no campo que nunca casa.
drop function if exists public.registrar_desfecho_pagamento(text, text, text, jsonb);

create or replace function public.registrar_desfecho_pagamento(
  p_pagamento_id  text,
  p_status        text,
  p_id_provedor   text default null,
  p_bruto         jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pag  public.pagamentos_online%rowtype;
  v_ag   public.agendamentos%rowtype;
  v_par  public.parametros_agenda%rowtype;
  v_fuso text := public.fuso_empresa();
begin
  select * into v_pag from public.pagamentos_online where id = p_pagamento_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'cobranca nao encontrada');
  end if;

  -- O provedor reenvia a notificacao ate receber confirmacao. Sem esta saida, a
  -- mesma cobranca confirmaria o agendamento varias vezes.
  if v_pag.status = p_status then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;

  update public.pagamentos_online
  set status = p_status,
      "referenciaExterna" = coalesce(p_id_provedor, "referenciaExterna"),
      bruto = coalesce(p_bruto, bruto),
      "pagoEm" = case when p_status = 'PAGO' then now() else "pagoEm" end,
      "atualizadoEm" = now()
  where id = v_pag.id;

  if v_pag."agendamentoId" is null then
    return jsonb_build_object('ok', true, 'agendamento', null);
  end if;

  select * into v_ag from public.agendamentos where id = v_pag."agendamentoId" for update;
  select * into v_par from public.parametros_agenda where id = 'default';

  if p_status = 'PAGO' then
    update public.agendamentos
    set status = case when v_par."confirmarAoPagar" and status = 'PENDENTE'
                   then 'CONFIRMADO' else status end,
        "confirmadoEm" = case when v_par."confirmarAoPagar" and status = 'PENDENTE'
                           then now() else "confirmadoEm" end,
        "reservadoAte" = null,
        "atualizadoEm" = now()
    where id = v_ag.id;

    insert into public.alertas
      (id, tipo, status, titulo, descricao, "dataAlvo", "criadoEm")
    values
      (gen_random_uuid()::text, 'FINANCEIRO_VENCIMENTO', 'PENDENTE',
       'Pagamento recebido — agendamento #' || v_ag.numero,
       v_ag.nome || ' pagou R$ ' || to_char(v_pag.valor, 'FM999G999G990D00')
         || ' para ' || to_char(v_ag.inicio at time zone v_fuso, 'DD/MM HH24:MI') || '.',
       now(), now());

  elsif p_status in ('RECUSADO','EXPIRADO','CANCELADO') then
    update public.agendamentos
    set status = 'CANCELADO',
        "canceladoEm" = now(),
        "motivoCancelamento" = 'Pagamento nao concluido (' || p_status || ')',
        "atualizadoEm" = now()
    where id = v_ag.id and status = 'PENDENTE';
  end if;

  return jsonb_build_object('ok', true, 'agendamento', v_ag.numero, 'status', p_status);
end;
$$;

revoke all on function public.registrar_desfecho_pagamento(text, text, text, jsonb)
  from public, anon;
