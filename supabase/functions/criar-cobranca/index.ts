/**
 * Cria a cobrança de um agendamento.
 *
 * Existe porque a chave secreta do provedor não pode viver no navegador: quem
 * a lesse criaria cobranças em nome da loja. Esta função roda no servidor do
 * Supabase, é o único lugar onde a chave aparece, e devolve ao site apenas o
 * endereço do checkout.
 *
 * Chamada pelo visitante do site, sem login — por isso ela desconfia de tudo
 * que recebe. Em particular, NÃO aceita o valor vindo do cliente: quem manda
 * quanto custa é o catálogo no banco. Sem isso, qualquer um pagaria um real por
 * uma vitrificação.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { obterProvedor } from "../_compartilhado/provedores.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "método não permitido" }, 405);

  try {
    const { agendamentoId, urlRetorno } = await req.json();
    if (!agendamentoId) return json({ erro: "agendamentoId é obrigatório" }, 400);

    // Chave de serviço: a função precisa ler o agendamento e gravar a cobrança,
    // e o visitante não tem permissão para nenhum dos dois.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ag, error: erroAg } = await sb
      .from("agendamentos")
      .select("*, servicos(nome, preco)")
      .eq("id", agendamentoId)
      .maybeSingle();

    if (erroAg) throw erroAg;
    if (!ag) return json({ erro: "agendamento não encontrado" }, 404);
    if (ag.status === "CANCELADO") {
      return json({ erro: "este agendamento foi cancelado" }, 409);
    }

    // Cobrança já criada e ainda válida: devolve a mesma em vez de abrir outra.
    // Recarregar a página do checkout não pode gerar duas cobranças.
    const { data: existente } = await sb
      .from("pagamentos_online")
      .select("*")
      .eq("agendamentoId", agendamentoId)
      .in("status", ["CRIADO", "PENDENTE"])
      .gt("expiraEm", new Date().toISOString())
      .maybeSingle();

    if (existente?.urlPagamento) {
      return json({
        pagamentoId: existente.id,
        url: existente.urlPagamento,
        valor: Number(existente.valor),
        reaproveitada: true,
      });
    }

    const { data: par } = await sb
      .from("parametros_agenda").select("*").eq("id", "default").maybeSingle();

    const precoServico = Number(ag.servicos?.preco ?? 0);
    if (precoServico <= 0) {
      return json({ erro: "serviço sem preço definido" }, 409);
    }

    // O valor sai do catálogo, nunca do que o navegador mandou.
    const valor = par?.tipoCobranca === "TOTAL"
      ? precoServico
      : Math.round(precoServico * Number(par?.sinalPct ?? 30)) / 100;

    const minutos = Number(par?.minutosReserva ?? 30);
    const pagamentoId = crypto.randomUUID();

    const provedor = obterProvedor(par?.provedor ?? "MERCADO_PAGO");
    const base = Deno.env.get("SUPABASE_URL")!;

    const cobranca = await provedor.criarCobranca({
      referenciaInterna: pagamentoId,
      descricao: `${ag.servicos?.nome ?? "Serviço"} — agendamento #${ag.numero}`,
      valor,
      minutos,
      pagador: { nome: ag.nome, telefone: ag.telefone },
      urlRetorno: urlRetorno ?? base,
      urlWebhook: `${base}/functions/v1/webhook-pagamento`,
    });

    const { error: erroIns } = await sb.from("pagamentos_online").insert({
      id: pagamentoId,
      agendamentoId,
      provedor: provedor.nome,
      referenciaExterna: cobranca.referenciaExterna,
      status: "PENDENTE",
      valor,
      urlPagamento: cobranca.urlPagamento,
      bruto: cobranca.bruto,
      expiraEm: cobranca.expiraEm,
    });
    if (erroIns) throw erroIns;

    // Prende o horário enquanto o pagamento não vem. Sem prazo, cada checkout
    // abandonado deixaria um buraco morto no dia.
    await sb.from("agendamentos").update({
      pagamentoId,
      valorCobrado: valor,
      reservadoAte: cobranca.expiraEm,
      atualizadoEm: new Date().toISOString(),
    }).eq("id", agendamentoId);

    return json({
      pagamentoId,
      url: cobranca.urlPagamento,
      valor,
      expiraEm: cobranca.expiraEm,
    });
  } catch (e) {
    // A mensagem interna vai para o log, não para a resposta: ela pode conter
    // detalhe do provedor que não interessa a quem está do outro lado.
    console.error("criar-cobranca:", e);
    return json({ erro: "não foi possível iniciar o pagamento" }, 500);
  }
});
