"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Estado = { erro?: string; ok?: string };

const vistoriaSchema = z.object({
  ordemId: z.string().min(1, "Ordem de serviço não informada."),
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  funcionarioId: z.string().min(1, "Informe o funcionário responsável pela vistoria."),
  km: z.string().optional(),
  combustivel: z.string().optional(),
  pertences: z.string().trim().max(1000).optional(),
  observacoes: z.string().trim().max(2000).optional(),
  aprovadaCliente: z.coerce.boolean().default(false),
  assinaturaCliente: z.string().optional(),
});

export async function salvarVistoriaAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("vistorias");

  const r = vistoriaSchema.safeParse({
    ordemId: dados.get("ordemId") ?? "",
    tipo: dados.get("tipo") ?? "ENTRADA",
    funcionarioId: dados.get("funcionarioId") ?? "",
    km: dados.get("km") ?? "",
    combustivel: dados.get("combustivel") ?? "",
    pertences: dados.get("pertences") ?? "",
    observacoes: dados.get("observacoes") ?? "",
    aprovadaCliente: dados.get("aprovadaCliente") === "on",
    assinaturaCliente: dados.get("assinaturaCliente") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const v = r.data;

  let checklist: unknown = {};
  let avarias: unknown = [];
  try {
    checklist = JSON.parse(String(dados.get("checklist") ?? "{}"));
    avarias = JSON.parse(String(dados.get("avarias") ?? "[]"));
  } catch {
    return { erro: "Falha ao ler o checklist." };
  }

  const ordem = await prisma.ordemServico.findUnique({
    where: { id: v.ordemId },
    include: { vistorias: true },
  });
  if (!ordem) return { erro: "Ordem de serviço não encontrada." };

  // Uma vistoria de cada tipo por OS: a nova substitui a anterior.
  const existente = ordem.vistorias.find((x) => x.tipo === v.tipo);
  const km = v.km ? Number(v.km.replace(/\D/g, "")) || null : null;

  const payload = {
    ordemId: v.ordemId,
    tipo: v.tipo,
    funcionarioId: v.funcionarioId,
    km,
    combustivel: v.combustivel || null,
    checklist: checklist as never,
    avarias: avarias as never,
    pertences: v.pertences?.trim() || null,
    observacoes: v.observacoes?.trim() || null,
    aprovadaCliente: v.aprovadaCliente,
    assinaturaCliente: v.assinaturaCliente?.startsWith("data:image")
      ? v.assinaturaCliente
      : null,
  };

  let vistoriaId: string;
  try {
    if (existente) {
      await prisma.vistoria.update({ where: { id: existente.id }, data: payload });
      vistoriaId = existente.id;
    } else {
      const nova = await prisma.vistoria.create({ data: payload });
      vistoriaId = nova.id;
    }
  } catch {
    return { erro: "Não foi possível salvar a vistoria." };
  }

  revalidatePath(`/sistema/ordens/${v.ordemId}`);
  revalidatePath("/sistema/vistorias");
  redirect(`/sistema/vistorias/${vistoriaId}`);
}
