"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/negocio";

export type Estado = { erro?: string; ok?: string };

const servicoSchema = z.object({
  codigo: z.string().trim().min(2, "Informe um código.").max(20),
  nome: z.string().trim().min(3, "Informe o nome do serviço.").max(120),
  descricao: z.string().trim().max(600).optional(),
  categoria: z.enum([
    "LAVAGEM",
    "ESTETICA",
    "FUNILARIA",
    "PINTURA",
    "PELICULA",
    "REVITALIZACAO",
    "VITRIFICACAO",
    "MECANICA",
    "OUTROS",
  ]),
  preco: z.coerce.number().min(0, "Preço inválido."),
  custo: z.coerce.number().min(0),
  duracaoMin: z.coerce.number().int().min(0),
  garantiaDias: z.coerce.number().int().min(0).max(3650),
  comissaoPct: z.coerce.number().min(0).max(100, "Comissão máxima é 100%."),
});

export async function salvarServicoAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("servicos");

  const id = String(dados.get("id") ?? "");
  const r = servicoSchema.safeParse({
    codigo: dados.get("codigo") ?? "",
    nome: dados.get("nome") ?? "",
    descricao: dados.get("descricao") ?? "",
    categoria: dados.get("categoria") ?? "OUTROS",
    preco: dados.get("preco") ?? 0,
    custo: dados.get("custo") ?? 0,
    duracaoMin: dados.get("duracaoMin") ?? 60,
    garantiaDias: dados.get("garantiaDias") ?? 0,
    comissaoPct: dados.get("comissaoPct") ?? 0,
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const payload = {
    codigo: v.codigo.toUpperCase(),
    nome: v.nome,
    descricao: v.descricao?.trim() || null,
    categoria: v.categoria,
    preco: dec(v.preco),
    custo: dec(v.custo),
    duracaoMin: v.duracaoMin,
    garantiaDias: v.garantiaDias,
    comissaoPct: dec(v.comissaoPct),
  };

  try {
    if (id) await prisma.servico.update({ where: { id }, data: payload });
    else await prisma.servico.create({ data: payload });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { erro: "Já existe um serviço com este código." };
    }
    return { erro: "Não foi possível salvar o serviço." };
  }

  revalidatePath("/sistema/servicos");
  return { ok: id ? "Serviço atualizado." : "Serviço cadastrado." };
}

export async function alternarAtivoServicoAction(id: string) {
  await exigirModulo("servicos");
  const s = await prisma.servico.findUnique({ where: { id } });
  if (!s) return;
  await prisma.servico.update({ where: { id }, data: { ativo: !s.ativo } });
  revalidatePath("/sistema/servicos");
}
