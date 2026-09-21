"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Estado = { erro?: string; ok?: string };

const empresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da empresa."),
  cnpj: z.string().trim().max(20).optional(),
  telefone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  email: z.union([z.string().trim().email("E-mail inválido."), z.literal("")]),
  endereco: z.string().trim().max(160).optional(),
  cidade: z.string().trim().max(80).optional(),
  uf: z.string().trim().max(2).optional(),
  cep: z.string().trim().max(12).optional(),
  instagram: z.string().trim().max(120).optional(),
  observacoesOrcamento: z.string().trim().max(1000).optional(),
});

const nulo = (v?: string) => (v?.trim() ? v.trim() : null);

export async function salvarEmpresaAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirPapel("ADMIN");

  const r = empresaSchema.safeParse({
    nome: dados.get("nome") ?? "",
    cnpj: dados.get("cnpj") ?? "",
    telefone: dados.get("telefone") ?? "",
    whatsapp: dados.get("whatsapp") ?? "",
    email: dados.get("email") ?? "",
    endereco: dados.get("endereco") ?? "",
    cidade: dados.get("cidade") ?? "",
    uf: dados.get("uf") ?? "",
    cep: dados.get("cep") ?? "",
    instagram: dados.get("instagram") ?? "",
    observacoesOrcamento: dados.get("observacoesOrcamento") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const payload = {
    nome: v.nome,
    cnpj: nulo(v.cnpj),
    telefone: nulo(v.telefone),
    whatsapp: nulo(v.whatsapp),
    email: nulo(v.email),
    endereco: nulo(v.endereco),
    cidade: nulo(v.cidade),
    uf: nulo(v.uf)?.toUpperCase() ?? null,
    cep: nulo(v.cep),
    instagram: nulo(v.instagram),
    observacoesOrcamento: nulo(v.observacoesOrcamento),
  };

  try {
    await prisma.empresa.upsert({
      where: { id: "default" },
      create: { id: "default", ...payload },
      update: payload,
    });
  } catch {
    return { erro: "Não foi possível salvar os dados da empresa." };
  }

  revalidatePath("/sistema/configuracoes");
  return { ok: "Dados salvos. Os próximos PDFs já usam este cabeçalho." };
}
