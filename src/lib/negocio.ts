import "server-only";
import { Prisma, type StatusOS } from "@prisma/client";
import { prisma } from "./prisma";
import { num, referenciaMes, somaDias } from "./format";

/* ============================================================
   Regras de negocio reaproveitadas por varias telas/acoes.
   ============================================================ */

export type ItemCalculavel = {
  quantidade: number;
  precoUnit: number;
  desconto: number;
};

/** Total de um item = (qtd x preco) - desconto, nunca negativo. */
export function totalItem(i: ItemCalculavel): number {
  return Math.max(0, i.quantidade * i.precoUnit - i.desconto);
}

/** Aplica desconto do documento sobre a soma dos itens. */
export function totalizar(
  itens: ItemCalculavel[],
  descontoTipo: "VALOR" | "PERCENTUAL",
  desconto: number,
) {
  const subtotal = itens.reduce((s, i) => s + totalItem(i), 0);
  const abatimento =
    descontoTipo === "PERCENTUAL"
      ? (subtotal * Math.min(Math.max(desconto, 0), 100)) / 100
      : Math.max(desconto, 0);
  const total = Math.max(0, subtotal - abatimento);
  return { subtotal, abatimento, total };
}

/** Converte number para Decimal do Prisma com 2 casas. */
export function dec(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v.toFixed(2));
}

/* ------------------------------------------------------------
   Alertas
   ------------------------------------------------------------ */

/**
 * Ao entregar uma OS, gera:
 *  - 1 alerta de pos-venda (contato de satisfacao em 3 dias);
 *  - 1 alerta de retorno por item com garantia, na data de vencimento.
 * Idempotente: remove alertas pendentes anteriores da mesma OS antes de recriar.
 */
export async function gerarAlertasDeEntrega(ordemId: string) {
  const ordem = await prisma.ordemServico.findUnique({
    where: { id: ordemId },
    include: { itens: true, cliente: true, veiculo: true },
  });
  if (!ordem) return;

  const base = ordem.dataSaida ?? new Date();
  const veiculo = `${ordem.veiculo.marca} ${ordem.veiculo.modelo} (${ordem.veiculo.placa})`;

  await prisma.alerta.deleteMany({
    where: {
      ordemId,
      status: "PENDENTE",
      tipo: { in: ["POS_VENDA", "RETORNO_GARANTIA", "ENTREGA_ATRASADA"] },
    },
  });

  const novos: Prisma.AlertaCreateManyInput[] = [
    {
      tipo: "POS_VENDA",
      titulo: `Pos-venda: ${ordem.cliente.nome}`,
      descricao: `Confirmar satisfacao com o servico da OS ${ordem.numero} - ${veiculo}.`,
      dataAlvo: somaDias(base, 3),
      clienteId: ordem.clienteId,
      veiculoId: ordem.veiculoId,
      ordemId: ordem.id,
    },
  ];

  // Um retorno por prazo de garantia distinto, agrupando os servicos.
  const porPrazo = new Map<number, string[]>();
  for (const item of ordem.itens) {
    if (item.garantiaDias > 0 && item.status === "CONCLUIDO") {
      const lista = porPrazo.get(item.garantiaDias) ?? [];
      lista.push(item.descricao);
      porPrazo.set(item.garantiaDias, lista);
    }
  }

  for (const [dias, servicos] of porPrazo) {
    novos.push({
      tipo: "RETORNO_GARANTIA",
      titulo: `Retorno de garantia (${dias} dias): ${ordem.cliente.nome}`,
      descricao: `${veiculo} - ${servicos.join(", ")}. Agendar revisao antes do fim da garantia.`,
      dataAlvo: somaDias(base, dias),
      clienteId: ordem.clienteId,
      veiculoId: ordem.veiculoId,
      ordemId: ordem.id,
    });
  }

  await prisma.alerta.createMany({ data: novos });
}

/**
 * Varredura de manutencao: marca orcamentos vencidos, lancamentos atrasados
 * e cria alertas de entrega atrasada. Chamada ao abrir o painel.
 */
export async function sincronizarPendencias() {
  const agora = new Date();

  await prisma.orcamento.updateMany({
    where: { status: { in: ["RASCUNHO", "ENVIADO"] }, validoAte: { lt: agora } },
    data: { status: "EXPIRADO" },
  });

  await prisma.lancamento.updateMany({
    where: { status: "PENDENTE", vencimento: { lt: agora } },
    data: { status: "ATRASADO" },
  });

  // OS com previsao vencida e ainda nao entregue
  const atrasadas = await prisma.ordemServico.findMany({
    where: {
      status: { in: ["AGUARDANDO", "EM_ANDAMENTO", "PAUSADA"] },
      previsaoEntrega: { lt: agora },
      alertas: { none: { tipo: "ENTREGA_ATRASADA", status: "PENDENTE" } },
    },
    include: { cliente: true, veiculo: true },
    take: 50,
  });

  if (atrasadas.length > 0) {
    await prisma.alerta.createMany({
      data: atrasadas.map((o) => ({
        tipo: "ENTREGA_ATRASADA" as const,
        titulo: `OS ${o.numero} atrasada: ${o.cliente.nome}`,
        descricao: `${o.veiculo.marca} ${o.veiculo.modelo} (${o.veiculo.placa}) passou da previsao de entrega.`,
        dataAlvo: o.previsaoEntrega ?? agora,
        clienteId: o.clienteId,
        veiculoId: o.veiculoId,
        ordemId: o.id,
      })),
    });
  }
}

/* ------------------------------------------------------------
   Financeiro e comissoes
   ------------------------------------------------------------ */

/**
 * Lanca a receita da OS no financeiro (uma vez) e calcula as comissoes
 * dos responsaveis pelos itens concluidos.
 */
export async function faturarOrdem(
  ordemId: string,
  opcoes: { forma?: Prisma.LancamentoCreateInput["forma"]; parcelas?: number } = {},
) {
  const ordem = await prisma.ordemServico.findUnique({
    where: { id: ordemId },
    include: {
      cliente: true,
      veiculo: true,
      itens: { include: { responsavel: true, servico: true } },
      lancamentos: true,
    },
  });
  if (!ordem) return;

  const total = num(ordem.total);

  // --- Receita ---
  if (ordem.lancamentos.length === 0 && total > 0) {
    const parcelas = Math.max(1, opcoes.parcelas ?? 1);
    const valorParcela = total / parcelas;
    const categoria = await prisma.categoriaFinanceira.findFirst({
      where: { tipo: "RECEITA", nome: "Servicos" },
    });

    await prisma.lancamento.createMany({
      data: Array.from({ length: parcelas }, (_, i) => ({
        tipo: "RECEITA" as const,
        status: "PENDENTE" as const,
        descricao: `OS ${ordem.numero} - ${ordem.cliente.nome} (${ordem.veiculo.placa})`,
        valor: dec(valorParcela),
        vencimento: somaDias(new Date(), i * 30),
        forma: opcoes.forma ?? null,
        categoriaId: categoria?.id ?? null,
        ordemId: ordem.id,
        parcela: parcelas > 1 ? i + 1 : null,
        totalParcelas: parcelas > 1 ? parcelas : null,
      })),
    });
  }

  // --- Comissoes ---
  await prisma.comissao.deleteMany({ where: { ordemId, pago: false } });

  // O desconto do documento (dado no fechamento, fora das linhas) precisa ser
  // rateado entre os itens. Sem isso a comissao incidiria sobre o valor cheio,
  // ou seja, sobre dinheiro que a loja nao recebeu.
  const somaItens = ordem.itens
    .filter((i) => i.status !== "CANCELADO")
    .reduce((s, i) => s + num(i.total), 0);
  const proporcao = somaItens > 0 ? Math.min(1, total / somaItens) : 1;

  const porFuncionario = new Map<string, { base: number; pct: number }>();
  for (const item of ordem.itens) {
    if (item.status !== "CONCLUIDO" || !item.responsavelId) continue;
    const pct =
      num(item.servico?.comissaoPct) || num(item.responsavel?.comissaoPct) || 0;
    if (pct <= 0) continue;
    const atual = porFuncionario.get(item.responsavelId) ?? { base: 0, pct };
    atual.base += num(item.total) * proporcao;
    atual.pct = pct;
    porFuncionario.set(item.responsavelId, atual);
  }

  const referencia = referenciaMes(ordem.dataSaida ?? new Date());
  const comissoes = [...porFuncionario.entries()].map(([funcionarioId, c]) => ({
    funcionarioId,
    ordemId: ordem.id,
    baseCalculo: dec(c.base),
    percentual: dec(c.pct),
    valor: dec((c.base * c.pct) / 100),
    referencia,
  }));

  if (comissoes.length > 0) {
    await prisma.comissao.createMany({ data: comissoes });
  }
}

/** Recalcula subtotal/desconto/total da OS a partir dos itens. */
export async function recalcularOrdem(ordemId: string) {
  const itens = await prisma.ordemServicoItem.findMany({
    where: { ordemId, status: { not: "CANCELADO" } },
  });
  const ordem = await prisma.ordemServico.findUnique({ where: { id: ordemId } });
  if (!ordem) return;

  const subtotal = itens.reduce((s, i) => s + num(i.total), 0);
  const total = Math.max(0, subtotal - num(ordem.desconto));

  await prisma.ordemServico.update({
    where: { id: ordemId },
    data: { subtotal: dec(subtotal), total: dec(total) },
  });
}

/** Recalcula subtotal/total do orcamento a partir dos itens. */
export async function recalcularOrcamento(orcamentoId: string) {
  const orc = await prisma.orcamento.findUnique({
    where: { id: orcamentoId },
    include: { itens: true },
  });
  if (!orc) return;

  const { subtotal, total } = totalizar(
    orc.itens.map((i) => ({
      quantidade: num(i.quantidade),
      precoUnit: num(i.precoUnit),
      desconto: num(i.desconto),
    })),
    orc.descontoTipo === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
    num(orc.desconto),
  );

  await prisma.orcamento.update({
    where: { id: orcamentoId },
    data: { subtotal: dec(subtotal), total: dec(total) },
  });
}

/** Transicoes de status permitidas na OS. */
export const TRANSICOES_OS: Record<StatusOS, StatusOS[]> = {
  AGUARDANDO: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["PAUSADA", "PRONTA", "CANCELADA"],
  PAUSADA: ["EM_ANDAMENTO", "CANCELADA"],
  PRONTA: ["EM_ANDAMENTO", "ENTREGUE"],
  ENTREGUE: [],
  CANCELADA: [],
};
