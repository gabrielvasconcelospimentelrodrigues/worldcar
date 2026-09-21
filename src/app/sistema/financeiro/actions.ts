"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/negocio";
import { somaDias } from "@/lib/format";

export type Estado = { erro?: string; ok?: string };

const FORMAS = [
  "DINHEIRO",
  "PIX",
  "DEBITO",
  "CREDITO",
  "BOLETO",
  "TRANSFERENCIA",
  "OUTRO",
] as const;

const lancamentoSchema = z.object({
  tipo: z.enum(["RECEITA", "DESPESA"]),
  descricao: z.string().trim().min(3, "Descreva o lançamento."),
  valor: z.coerce.number().positive("Informe um valor maior que zero."),
  vencimento: z.string().min(1, "Informe o vencimento."),
  categoriaId: z.string().optional(),
  forma: z.string().optional(),
  fornecedor: z.string().trim().max(120).optional(),
  observacoes: z.string().trim().max(500).optional(),
  parcelas: z.coerce.number().int().min(1).max(36).default(1),
  jaPago: z.coerce.boolean().default(false),
});

export async function salvarLancamentoAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("financeiro");

  const r = lancamentoSchema.safeParse({
    tipo: dados.get("tipo") ?? "DESPESA",
    descricao: dados.get("descricao") ?? "",
    valor: dados.get("valor") ?? 0,
    vencimento: dados.get("vencimento") ?? "",
    categoriaId: dados.get("categoriaId") ?? "",
    forma: dados.get("forma") ?? "",
    fornecedor: dados.get("fornecedor") ?? "",
    observacoes: dados.get("observacoes") ?? "",
    parcelas: dados.get("parcelas") ?? 1,
    jaPago: dados.get("jaPago") === "on",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const forma = FORMAS.includes(v.forma as (typeof FORMAS)[number])
    ? (v.forma as (typeof FORMAS)[number])
    : null;

  const base = new Date(`${v.vencimento}T12:00:00`);
  const valorParcela = v.valor / v.parcelas;

  try {
    await prisma.lancamento.createMany({
      data: Array.from({ length: v.parcelas }, (_, i) => ({
        tipo: v.tipo,
        status: v.jaPago ? ("PAGO" as const) : ("PENDENTE" as const),
        descricao:
          v.parcelas > 1
            ? `${v.descricao} (${i + 1}/${v.parcelas})`
            : v.descricao,
        valor: dec(valorParcela),
        vencimento: somaDias(base, i * 30),
        pagamento: v.jaPago ? new Date() : null,
        forma,
        categoriaId: v.categoriaId || null,
        fornecedor: v.fornecedor?.trim() || null,
        observacoes: v.observacoes?.trim() || null,
        parcela: v.parcelas > 1 ? i + 1 : null,
        totalParcelas: v.parcelas > 1 ? v.parcelas : null,
      })),
    });
  } catch {
    return { erro: "Não foi possível salvar o lançamento." };
  }

  revalidatePath("/sistema/financeiro");
  revalidatePath("/sistema");
  return { ok: v.parcelas > 1 ? `${v.parcelas} parcelas lançadas.` : "Lançamento salvo." };
}

export async function baixarLancamentoAction(dados: FormData) {
  await exigirModulo("financeiro");
  const id = String(dados.get("id") ?? "");
  const forma = String(dados.get("forma") ?? "");
  if (!id) return;

  const l = await prisma.lancamento.findUnique({ where: { id } });
  if (!l) return;

  // Alterna entre pago e pendente, para desfazer uma baixa errada.
  const voltandoAPendente = l.status === "PAGO";
  await prisma.lancamento.update({
    where: { id },
    data: {
      status: voltandoAPendente
        ? l.vencimento < new Date()
          ? "ATRASADO"
          : "PENDENTE"
        : "PAGO",
      pagamento: voltandoAPendente ? null : new Date(),
      forma: voltandoAPendente
        ? l.forma
        : FORMAS.includes(forma as (typeof FORMAS)[number])
          ? (forma as (typeof FORMAS)[number])
          : l.forma,
    },
  });

  revalidatePath("/sistema/financeiro");
  revalidatePath("/sistema");
}

export async function excluirLancamentoAction(dados: FormData) {
  await exigirModulo("financeiro");
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  await prisma.lancamento.delete({ where: { id } });
  revalidatePath("/sistema/financeiro");
}

export async function pagarComissaoAction(dados: FormData) {
  await exigirModulo("financeiro");
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const c = await prisma.comissao.findUnique({
    where: { id },
    include: { funcionario: true },
  });
  if (!c || c.pago) return;

  await prisma.$transaction([
    prisma.comissao.update({
      where: { id },
      data: { pago: true, pagoEm: new Date() },
    }),
    prisma.lancamento.create({
      data: {
        tipo: "DESPESA",
        status: "PAGO",
        descricao: `Comissão ${c.referencia} — ${c.funcionario.nome}`,
        valor: c.valor,
        vencimento: new Date(),
        pagamento: new Date(),
        ordemId: c.ordemId,
      },
    }),
  ]);

  revalidatePath("/sistema/financeiro");
  revalidatePath("/sistema/rh");
}
