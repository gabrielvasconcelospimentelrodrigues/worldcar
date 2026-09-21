"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { StatusOS } from "@prisma/client";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TRANSICOES_OS,
  dec,
  faturarOrdem,
  gerarAlertasDeEntrega,
  recalcularOrdem,
  totalItem,
} from "@/lib/negocio";

export type Estado = { erro?: string; ok?: string };

function revalidar(id: string) {
  revalidatePath(`/sistema/ordens/${id}`);
  revalidatePath("/sistema/ordens");
  revalidatePath("/sistema");
}

/**
 * Mantem o status da OS coerente com o andamento dos itens.
 *
 * Sem isso uma OS onde a equipe marca os servicos direto como concluidos
 * (sem passar por "executando") ficaria parada em "Aguardando" no quadro, e
 * o indicador "Prontos para retirada" do painel nunca acenderia — que e
 * justamente o aviso para a recepcao ligar para o cliente.
 * A entrega em si continua exclusiva de `registrarSaidaAction`.
 */
async function ajustarStatusPorItens(ordemId: string) {
  const ordem = await prisma.ordemServico.findUnique({
    where: { id: ordemId },
    include: { itens: true },
  });
  if (!ordem) return;
  if (!["AGUARDANDO", "EM_ANDAMENTO", "PRONTA"].includes(ordem.status)) return;

  const ativos = ordem.itens.filter((i) => i.status !== "CANCELADO");
  const concluidos = ativos.filter((i) => i.status === "CONCLUIDO");
  const encostou = ordem.itens.some((i) =>
    ["EXECUTANDO", "CONCLUIDO"].includes(i.status),
  );

  let novo = ordem.status;
  if (ativos.length > 0 && concluidos.length === ativos.length) novo = "PRONTA";
  else if (encostou) novo = "EM_ANDAMENTO";
  else novo = "AGUARDANDO";

  if (novo !== ordem.status) {
    await prisma.ordemServico.update({ where: { id: ordemId }, data: { status: novo } });
  }
}

/* ------------------------------------------------------------
   Abertura de OS sem orçamento (entrada direta na oficina)
   ------------------------------------------------------------ */

const novaOrdemSchema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  veiculoId: z.string().min(1, "Selecione o veículo."),
  funcionarioEntradaId: z.string().min(1, "Informe quem está recebendo o veículo."),
  kmEntrada: z.string().optional(),
  combustivelEntrada: z.string().optional(),
  previsaoEntrega: z.string().optional(),
  observacoesEntrada: z.string().trim().max(1000).optional(),
  itens: z
    .array(
      z.object({
        servicoId: z.string().optional().nullable(),
        descricao: z.string().trim().min(1),
        quantidade: z.coerce.number().min(0.01),
        precoUnit: z.coerce.number().min(0),
        desconto: z.coerce.number().min(0),
        garantiaDias: z.coerce.number().int().min(0).default(0),
      }),
    )
    .min(1, "Adicione pelo menos um serviço."),
});

export async function criarOrdemAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("ordens");

  let itensBrutos: unknown;
  try {
    itensBrutos = JSON.parse(String(dados.get("itens") ?? "[]"));
  } catch {
    return { erro: "Falha ao ler os serviços." };
  }

  const r = novaOrdemSchema.safeParse({
    clienteId: dados.get("clienteId") ?? "",
    veiculoId: dados.get("veiculoId") ?? "",
    funcionarioEntradaId: dados.get("funcionarioEntradaId") ?? "",
    kmEntrada: dados.get("kmEntrada") ?? "",
    combustivelEntrada: dados.get("combustivelEntrada") ?? "",
    previsaoEntrega: dados.get("previsaoEntrega") ?? "",
    observacoesEntrada: dados.get("observacoesEntrada") ?? "",
    itens: itensBrutos,
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const subtotal = v.itens.reduce((s, i) => s + totalItem(i), 0);
  const km = v.kmEntrada ? Number(v.kmEntrada.replace(/\D/g, "")) || null : null;

  let ordemId: string;
  try {
    const ordem = await prisma.ordemServico.create({
      data: {
        clienteId: v.clienteId,
        veiculoId: v.veiculoId,
        funcionarioEntradaId: v.funcionarioEntradaId,
        kmEntrada: km,
        combustivelEntrada: v.combustivelEntrada || null,
        previsaoEntrega: v.previsaoEntrega
          ? new Date(`${v.previsaoEntrega}T18:00:00`)
          : null,
        observacoesEntrada: v.observacoesEntrada?.trim() || null,
        subtotal: dec(subtotal),
        total: dec(subtotal),
        itens: {
          create: v.itens.map((i) => ({
            servicoId: i.servicoId || null,
            descricao: i.descricao,
            quantidade: dec(i.quantidade),
            precoUnit: dec(i.precoUnit),
            desconto: dec(i.desconto),
            total: dec(totalItem(i)),
            garantiaDias: i.garantiaDias,
          })),
        },
      },
    });
    ordemId = ordem.id;

    if (km && km > 0) {
      await prisma.veiculo.update({ where: { id: v.veiculoId }, data: { km } });
    }
  } catch {
    return { erro: "Não foi possível abrir a ordem de serviço." };
  }

  revalidatePath("/sistema/ordens");
  redirect(`/sistema/ordens/${ordemId}`);
}

/* ------------------------------------------------------------
   Execução: itens e status
   ------------------------------------------------------------ */

export async function atualizarItemAction(dados: FormData) {
  await exigirModulo("ordens");

  const itemId = String(dados.get("itemId") ?? "");
  const ordemId = String(dados.get("ordemId") ?? "");
  const status = String(dados.get("status") ?? "");
  const responsavelId = String(dados.get("responsavelId") ?? "");

  if (!itemId || !ordemId) return;

  const permitidos = ["PENDENTE", "EXECUTANDO", "CONCLUIDO", "CANCELADO"] as const;
  type St = (typeof permitidos)[number];
  if (!permitidos.includes(status as St)) return;

  const item = await prisma.ordemServicoItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.ordemServicoItem.update({
    where: { id: itemId },
    data: {
      status: status as St,
      responsavelId: responsavelId || null,
      iniciadoEm:
        status === "EXECUTANDO" && !item.iniciadoEm ? new Date() : item.iniciadoEm,
      concluidoEm: status === "CONCLUIDO" ? new Date() : null,
    },
  });

  await recalcularOrdem(ordemId);
  await ajustarStatusPorItens(ordemId);

  revalidar(ordemId);
}

export async function mudarStatusOrdemAction(dados: FormData) {
  await exigirModulo("ordens");

  const id = String(dados.get("id") ?? "");
  const novo = String(dados.get("status") ?? "") as StatusOS;
  if (!id) return;

  const ordem = await prisma.ordemServico.findUnique({ where: { id } });
  if (!ordem) return;
  if (!TRANSICOES_OS[ordem.status].includes(novo)) return;
  // A entrega tem fluxo próprio (registrarSaidaAction), com vistoria e alertas.
  if (novo === "ENTREGUE") return;

  await prisma.ordemServico.update({ where: { id }, data: { status: novo } });

  if (novo === "CANCELADA") {
    await prisma.alerta.updateMany({
      where: { ordemId: id, status: "PENDENTE" },
      data: { status: "CANCELADO" },
    });
  }

  revalidar(id);
}

/* ------------------------------------------------------------
   Saída: entrega do veículo
   ------------------------------------------------------------ */

const saidaSchema = z.object({
  id: z.string().min(1),
  funcionarioSaidaId: z.string().min(1, "Informe quem está entregando o veículo."),
  kmSaida: z.string().optional(),
  clienteRetirou: z.string().trim().min(3, "Informe quem retirou o veículo."),
  documentoRetirada: z.string().trim().max(30).optional(),
  observacoesSaida: z.string().trim().max(1000).optional(),
  formaPagamento: z.string().optional(),
  parcelas: z.coerce.number().int().min(1).max(24).default(1),
  assinaturaEntrega: z.string().optional(),
});

const FORMAS = [
  "DINHEIRO",
  "PIX",
  "DEBITO",
  "CREDITO",
  "BOLETO",
  "TRANSFERENCIA",
  "OUTRO",
] as const;

export async function registrarSaidaAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("ordens");

  const r = saidaSchema.safeParse({
    id: dados.get("id") ?? "",
    funcionarioSaidaId: dados.get("funcionarioSaidaId") ?? "",
    kmSaida: dados.get("kmSaida") ?? "",
    clienteRetirou: dados.get("clienteRetirou") ?? "",
    documentoRetirada: dados.get("documentoRetirada") ?? "",
    observacoesSaida: dados.get("observacoesSaida") ?? "",
    formaPagamento: dados.get("formaPagamento") ?? "",
    parcelas: dados.get("parcelas") ?? 1,
    assinaturaEntrega: dados.get("assinaturaEntrega") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const ordem = await prisma.ordemServico.findUnique({
    where: { id: v.id },
    include: { itens: true, vistorias: true },
  });
  if (!ordem) return { erro: "Ordem de serviço não encontrada." };
  if (ordem.status === "ENTREGUE") return { erro: "Esta OS já foi entregue." };
  if (ordem.status === "CANCELADA") return { erro: "Esta OS está cancelada." };

  const pendentes = ordem.itens.filter(
    (i) => i.status !== "CONCLUIDO" && i.status !== "CANCELADO",
  );
  if (pendentes.length > 0) {
    return {
      erro: `Ainda há ${pendentes.length} serviço(s) não concluído(s). Finalize ou cancele antes de entregar.`,
    };
  }

  const temVistoriaSaida = ordem.vistorias.some((x) => x.tipo === "SAIDA");
  if (!temVistoriaSaida) {
    return {
      erro: "Registre a vistoria de saída antes de entregar o veículo.",
    };
  }

  const km = v.kmSaida ? Number(v.kmSaida.replace(/\D/g, "")) || null : null;
  const forma = FORMAS.includes(v.formaPagamento as (typeof FORMAS)[number])
    ? (v.formaPagamento as (typeof FORMAS)[number])
    : undefined;

  await prisma.ordemServico.update({
    where: { id: v.id },
    data: {
      status: "ENTREGUE",
      dataSaida: new Date(),
      funcionarioSaidaId: v.funcionarioSaidaId,
      kmSaida: km,
      clienteRetirou: v.clienteRetirou,
      documentoRetirada: v.documentoRetirada?.trim() || null,
      observacoesSaida: v.observacoesSaida?.trim() || null,
      assinaturaEntrega: v.assinaturaEntrega?.startsWith("data:image")
        ? v.assinaturaEntrega
        : null,
    },
  });

  if (km && km > 0) {
    await prisma.veiculo.update({ where: { id: ordem.veiculoId }, data: { km } });
  }

  // Encerra o alerta de atraso e cria os de garantia/pós-venda.
  await prisma.alerta.updateMany({
    where: { ordemId: v.id, tipo: "ENTREGA_ATRASADA", status: "PENDENTE" },
    data: { status: "CANCELADO" },
  });

  await faturarOrdem(v.id, { forma, parcelas: v.parcelas });
  await gerarAlertasDeEntrega(v.id);

  revalidar(v.id);
  revalidatePath("/sistema/financeiro");
  revalidatePath("/sistema/alertas");
  return { ok: "Veículo entregue. Alertas de retorno e financeiro gerados." };
}

/* ------------------------------------------------------------
   Itens avulsos adicionados durante a execução
   ------------------------------------------------------------ */

export async function adicionarItemAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("ordens");

  const ordemId = String(dados.get("ordemId") ?? "");
  const servicoId = String(dados.get("servicoId") ?? "");
  const descricao = String(dados.get("descricao") ?? "").trim();
  const quantidade = Number(dados.get("quantidade") ?? 1) || 1;
  const precoUnit = Number(dados.get("precoUnit") ?? 0) || 0;

  if (!ordemId || !descricao) return { erro: "Descreva o serviço a adicionar." };

  const ordem = await prisma.ordemServico.findUnique({ where: { id: ordemId } });
  if (!ordem || ["ENTREGUE", "CANCELADA"].includes(ordem.status)) {
    return { erro: "Não é possível adicionar serviços a esta OS." };
  }

  const servico = servicoId
    ? await prisma.servico.findUnique({ where: { id: servicoId } })
    : null;

  await prisma.ordemServicoItem.create({
    data: {
      ordemId,
      servicoId: servico?.id ?? null,
      descricao,
      quantidade: dec(quantidade),
      precoUnit: dec(precoUnit),
      desconto: dec(0),
      total: dec(quantidade * precoUnit),
      garantiaDias: servico?.garantiaDias ?? 0,
    },
  });

  await recalcularOrdem(ordemId);
  revalidar(ordemId);
  return { ok: "Serviço adicionado à OS." };
}

export async function removerItemAction(dados: FormData) {
  await exigirModulo("ordens");
  const itemId = String(dados.get("itemId") ?? "");
  const ordemId = String(dados.get("ordemId") ?? "");
  if (!itemId || !ordemId) return;

  const ordem = await prisma.ordemServico.findUnique({ where: { id: ordemId } });
  if (!ordem || ["ENTREGUE", "CANCELADA"].includes(ordem.status)) return;

  await prisma.ordemServicoItem.delete({ where: { id: itemId } });
  await recalcularOrdem(ordemId);
  revalidar(ordemId);
}
