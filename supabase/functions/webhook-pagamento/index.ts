/**
 * Recebe a confirmação de pagamento do provedor.
 *
 * Este endereço é público — tem que ser, o provedor precisa alcançá-lo. Por
 * isso ele não confia em nada do que chega no corpo:
 *
 *  1. Confere a assinatura, quando o provedor envia uma.
 *  2. Usa a notificação só para saber QUAL pagamento mudou, e então consulta a
 *     API do provedor para saber o estado verdadeiro. Sem isso, um POST
 *     dizendo "pagou" confirmaria agendamentos de graça.
 *
 * Responde 200 mesmo em caso ignorado: o provedor reenvia enquanto não receber
 * confirmação, e ficar reenviando uma notificação que nunca vai interessar só
 * gera ruído dos dois lados.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { obterProvedor } from "../_compartilhado/provedores.ts";

/**
 * Assinatura do Mercado Pago (cabeçalho `x-signature`).
 *
 * Formato: `ts=1699999999,v1=abcdef...`, e o que se assina é
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
async function assinaturaValida(req: Request, dataId: string): Promise<boolean> {
  const segredo = Deno.env.get("MP_WEBHOOK_SECRET");
  // Sem segredo configurado a checagem é pulada, mas fica registrado: rodar
  // assim em produção deixa o endereço aberto a quem descobrir o endereço.
  if (!segredo) {
    console.warn("MP_WEBHOOK_SECRET ausente: assinatura não verificada");
    return true;
  }

  const cabecalho = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!cabecalho) return false;

  const partes = Object.fromEntries(
    cabecalho.split(",").map((p) => p.split("=").map((x) => x.trim())),
  ) as { ts?: string; v1?: string };
  if (!partes.ts || !partes.v1) return false;

  const manifesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC", chave, new TextEncoder().encode(manifesto),
  );
  const esperado = Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  // Comparação de tempo constante: comparar com === vaza, pelo tempo de
  // resposta, quantos caracteres iniciais estavam certos.
  if (esperado.length !== partes.v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  }
  return diferenca === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("método não permitido", { status: 405 });
  }

  try {
    const corpo = await req.json();
    const dataId = String(corpo?.data?.id ?? "");

    if (dataId && !(await assinaturaValida(req, dataId))) {
      console.error("webhook: assinatura inválida");
      return new Response("assinatura inválida", { status: 401 });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: par } = await sb
      .from("parametros_agenda").select("provedor").eq("id", "default").maybeSingle();

    const provedor = obterProvedor(par?.provedor ?? "MERCADO_PAGO");
    const noticia = await provedor.lerNotificacao(corpo);

    // Notificação sobre outro assunto (o Mercado Pago avisa de várias coisas no
    // mesmo endereço). Confirma o recebimento para ele parar de reenviar.
    if (!noticia) return new Response("ignorado", { status: 200 });

    const { data, error } = await sb.rpc("registrar_desfecho_pagamento", {
      p_pagamento_id: noticia.referenciaInterna,
      p_status: noticia.status,
      p_id_provedor: noticia.idNoProvedor,
      p_bruto: noticia.bruto,
    });
    if (error) throw error;

    console.log("webhook:", JSON.stringify(data));
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook-pagamento:", e);
    // 500 faz o provedor tentar de novo, que é o certo quando a falha é nossa:
    // um erro momentâneo de banco não pode perder um pagamento confirmado.
    return new Response("erro ao processar", { status: 500 });
  }
});
