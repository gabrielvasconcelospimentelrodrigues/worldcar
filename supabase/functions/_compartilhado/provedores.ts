/**
 * Provedores de pagamento.
 *
 * O Mercado Pago e o primeiro, mas o resto do sistema nao sabe disso: fala com
 * a interface `Provedor`. Acrescentar Asaas ou Stripe depois e escrever um
 * objeto novo aqui e registra-lo no mapa do fim do arquivo — nada muda no banco
 * nem na tela.
 *
 * A traducao de status vive aqui de proposito. Cada provedor tem o seu
 * vocabulario ("approved", "RECEIVED", "succeeded") e deixar isso vazar para o
 * banco significaria que toda consulta precisaria conhecer todos eles.
 */

export type StatusPagamento =
  | "CRIADO" | "PENDENTE" | "PAGO" | "RECUSADO"
  | "ESTORNADO" | "EXPIRADO" | "CANCELADO";

export type PedidoCobranca = {
  referenciaInterna: string;
  descricao: string;
  valor: number;
  /** Minutos ate a cobranca expirar. */
  minutos: number;
  pagador: { nome: string; telefone: string };
  urlRetorno: string;
  urlWebhook: string;
};

export type CobrancaCriada = {
  referenciaExterna: string;
  urlPagamento: string;
  expiraEm: string;
  bruto: unknown;
};

export interface Provedor {
  nome: string;
  criarCobranca(p: PedidoCobranca): Promise<CobrancaCriada>;
  /**
   * Lê a notificação e devolve o que importa, ou null se não for relevante.
   *
   * `referenciaInterna` é o id do nosso registro, não o do provedor: o que a
   * notificação traz é o id do PAGAMENTO, enquanto na criação guardamos o id da
   * PREFERÊNCIA — são diferentes, e procurar por um achando o outro nunca
   * encontraria a cobrança. Por isso mandamos o nosso id no `external_reference`
   * e é por ele que voltamos.
   */
  lerNotificacao(
    corpo: unknown,
  ): Promise<{
    referenciaInterna: string;
    idNoProvedor: string;
    status: StatusPagamento;
    bruto: unknown;
  } | null>;
}

// ---------------------------------------------------------------- Mercado Pago

const MP_API = "https://api.mercadopago.com";

/** "approved" e "accredited" chegam em campos diferentes conforme o fluxo. */
function statusMercadoPago(s: string | undefined): StatusPagamento {
  switch (s) {
    case "approved":
    case "accredited":
      return "PAGO";
    case "pending":
    case "in_process":
    case "authorized":
      return "PENDENTE";
    case "rejected":
      return "RECUSADO";
    case "refunded":
    case "charged_back":
      return "ESTORNADO";
    case "cancelled":
      return "CANCELADO";
    default:
      return "PENDENTE";
  }
}

export function mercadoPago(token: string): Provedor {
  const cabecalho = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return {
    nome: "MERCADO_PAGO",

    async criarCobranca(p) {
      const expira = new Date(Date.now() + p.minutos * 60_000);

      const resposta = await fetch(`${MP_API}/checkout/preferences`, {
        method: "POST",
        headers: {
          ...cabecalho,
          // Evita cobrança duplicada se a função for reexecutada: o Mercado
          // Pago devolve a mesma preferência em vez de criar outra.
          "X-Idempotency-Key": p.referenciaInterna,
        },
        body: JSON.stringify({
          items: [{
            title: p.descricao,
            quantity: 1,
            unit_price: Number(p.valor.toFixed(2)),
            currency_id: "BRL",
          }],
          payer: { name: p.pagador.nome },
          // Amarra a cobrança ao nosso registro: é por aqui que a notificação
          // encontra o agendamento de volta.
          external_reference: p.referenciaInterna,
          notification_url: p.urlWebhook,
          back_urls: {
            success: `${p.urlRetorno}?pagamento=sucesso`,
            pending: `${p.urlRetorno}?pagamento=pendente`,
            failure: `${p.urlRetorno}?pagamento=falhou`,
          },
          auto_return: "approved",
          expires: true,
          expiration_date_to: expira.toISOString(),
          // Boleto não serve para segurar horário: compensa em dias, e até lá
          // a vaga já teria passado.
          payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
        }),
      });

      const corpo = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          `Mercado Pago recusou a cobranca: ${corpo?.message ?? resposta.status}`,
        );
      }

      return {
        referenciaExterna: String(corpo.id),
        urlPagamento: corpo.init_point ?? corpo.sandbox_init_point,
        expiraEm: expira.toISOString(),
        bruto: corpo,
      };
    },

    async lerNotificacao(corpo) {
      const c = corpo as { type?: string; action?: string; data?: { id?: string } };

      // O Mercado Pago avisa sobre vários assuntos no mesmo endereço. Só
      // pagamento interessa; o resto responde 200 e segue.
      const ehPagamento = c.type === "payment" || c.action?.startsWith("payment.");
      if (!ehPagamento || !c.data?.id) return null;

      // A notificação traz só o id: o estado verdadeiro vem de consultar a API.
      // Confiar no corpo recebido permitiria a qualquer um mandar um POST
      // dizendo que pagou.
      const r = await fetch(`${MP_API}/v1/payments/${c.data.id}`, {
        headers: cabecalho,
      });
      if (!r.ok) throw new Error(`falha ao consultar o pagamento ${c.data.id}`);
      const pag = await r.json();

      const referencia = pag.external_reference;
      if (!referencia) return null;

      return {
        referenciaInterna: String(referencia),
        idNoProvedor: String(pag.id),
        status: statusMercadoPago(pag.status ?? pag.status_detail),
        bruto: pag,
      };
    },
  };
}

// ------------------------------------------------------------------- registro

export function obterProvedor(nome: string): Provedor {
  switch (nome) {
    case "MERCADO_PAGO": {
      const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!token) {
        throw new Error(
          "MERCADOPAGO_ACCESS_TOKEN nao esta definido. " +
          "Use: npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=...",
        );
      }
      return mercadoPago(token);
    }
    default:
      throw new Error(`provedor de pagamento desconhecido: ${nome}`);
  }
}
