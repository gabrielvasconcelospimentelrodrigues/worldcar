"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Estado = { erro?: string; ok?: string };

export async function concluirAlertaAction(dados: FormData) {
  await exigirModulo("alertas");
  const id = String(dados.get("id") ?? "");
  const resultado = String(dados.get("resultado") ?? "").trim();
  if (!id) return;

  await prisma.alerta.update({
    where: { id },
    data: {
      status: "CONCLUIDO",
      concluidoEm: new Date(),
      resultado: resultado || null,
    },
  });

  revalidatePath("/sistema/alertas");
  revalidatePath("/sistema");
}

export async function cancelarAlertaAction(dados: FormData) {
  await exigirModulo("alertas");
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  await prisma.alerta.update({ where: { id }, data: { status: "CANCELADO" } });
  revalidatePath("/sistema/alertas");
  revalidatePath("/sistema");
}

export async function adiarAlertaAction(dados: FormData) {
  await exigirModulo("alertas");
  const id = String(dados.get("id") ?? "");
  const dias = Number(dados.get("dias") ?? 7) || 7;
  if (!id) return;

  const a = await prisma.alerta.findUnique({ where: { id } });
  if (!a) return;

  // Adia a partir de hoje, não da data original, para não continuar vencido.
  const base = a.dataAlvo > new Date() ? a.dataAlvo : new Date();
  const nova = new Date(base);
  nova.setDate(nova.getDate() + dias);

  await prisma.alerta.update({ where: { id }, data: { dataAlvo: nova } });
  revalidatePath("/sistema/alertas");
  revalidatePath("/sistema");
}

const manualSchema = z.object({
  titulo: z.string().trim().min(3, "Descreva o alerta."),
  descricao: z.string().trim().max(1000).optional(),
  dataAlvo: z.string().min(1, "Informe a data."),
  clienteId: z.string().optional(),
  tipo: z.enum([
    "RETORNO_GARANTIA",
    "RETORNO_MANUTENCAO",
    "POS_VENDA",
    "ORCAMENTO_EXPIRANDO",
    "FINANCEIRO_VENCIMENTO",
    "ENTREGA_ATRASADA",
  ]),
});

export async function criarAlertaAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("alertas");

  const r = manualSchema.safeParse({
    titulo: dados.get("titulo") ?? "",
    descricao: dados.get("descricao") ?? "",
    dataAlvo: dados.get("dataAlvo") ?? "",
    clienteId: dados.get("clienteId") ?? "",
    tipo: dados.get("tipo") ?? "RETORNO_MANUTENCAO",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  await prisma.alerta.create({
    data: {
      tipo: v.tipo,
      titulo: v.titulo,
      descricao: v.descricao?.trim() || null,
      dataAlvo: new Date(`${v.dataAlvo}T09:00:00`),
      clienteId: v.clienteId || null,
    },
  });

  revalidatePath("/sistema/alertas");
  return { ok: "Alerta criado." };
}
