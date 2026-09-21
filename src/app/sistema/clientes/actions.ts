"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Estado = { erro?: string; ok?: string };

const texto = (max = 200) => z.string().trim().max(max);

const clienteSchema = z.object({
  tipo: z.enum(["FISICA", "JURIDICA"]),
  nome: texto(160).min(3, "Informe o nome completo."),
  documento: texto(20).optional(),
  telefone: texto(20).min(8, "Informe um telefone válido."),
  telefone2: texto(20).optional(),
  email: z.union([z.string().trim().email("E-mail inválido."), z.literal("")]),
  cep: texto(12).optional(),
  endereco: texto(160).optional(),
  numero: texto(12).optional(),
  bairro: texto(80).optional(),
  cidade: texto(80).optional(),
  uf: texto(2).optional(),
  observacoes: texto(1000).optional(),
});

function vazioParaNulo(v: string | undefined) {
  const s = v?.trim();
  return s ? s : null;
}

function lerCliente(dados: FormData) {
  return clienteSchema.safeParse({
    tipo: dados.get("tipo") ?? "FISICA",
    nome: dados.get("nome") ?? "",
    documento: dados.get("documento") ?? "",
    telefone: dados.get("telefone") ?? "",
    telefone2: dados.get("telefone2") ?? "",
    email: dados.get("email") ?? "",
    cep: dados.get("cep") ?? "",
    endereco: dados.get("endereco") ?? "",
    numero: dados.get("numero") ?? "",
    bairro: dados.get("bairro") ?? "",
    cidade: dados.get("cidade") ?? "",
    uf: dados.get("uf") ?? "",
    observacoes: dados.get("observacoes") ?? "",
  });
}

export async function salvarClienteAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("clientes");

  const id = String(dados.get("id") ?? "");
  const r = lerCliente(dados);
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const payload = {
    tipo: v.tipo,
    nome: v.nome,
    documento: vazioParaNulo(v.documento)?.replace(/\D/g, "") ?? null,
    telefone: v.telefone,
    telefone2: vazioParaNulo(v.telefone2),
    email: vazioParaNulo(v.email),
    cep: vazioParaNulo(v.cep),
    endereco: vazioParaNulo(v.endereco),
    numero: vazioParaNulo(v.numero),
    bairro: vazioParaNulo(v.bairro),
    cidade: vazioParaNulo(v.cidade),
    uf: vazioParaNulo(v.uf)?.toUpperCase() ?? null,
    observacoes: vazioParaNulo(v.observacoes),
  };

  let destino: string;
  try {
    if (id) {
      await prisma.cliente.update({ where: { id }, data: payload });
      destino = `/sistema/clientes/${id}`;
    } else {
      const novo = await prisma.cliente.create({ data: payload });
      destino = `/sistema/clientes/${novo.id}`;
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { erro: "Já existe um cliente com este CPF/CNPJ." };
    }
    return { erro: "Não foi possível salvar o cliente." };
  }

  revalidatePath("/sistema/clientes");
  redirect(destino);
}

const veiculoSchema = z.object({
  clienteId: z.string().min(1),
  placa: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine((s) => s.length === 7, "Placa deve ter 7 caracteres."),
  marca: texto(40).min(2, "Informe a marca."),
  modelo: texto(60).min(1, "Informe o modelo."),
  ano: texto(4).optional(),
  cor: texto(30).optional(),
  chassi: texto(30).optional(),
  renavam: texto(20).optional(),
  km: texto(10).optional(),
  observacoes: texto(500).optional(),
});

export async function salvarVeiculoAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("clientes");

  const id = String(dados.get("id") ?? "");
  const r = veiculoSchema.safeParse({
    clienteId: dados.get("clienteId") ?? "",
    placa: dados.get("placa") ?? "",
    marca: dados.get("marca") ?? "",
    modelo: dados.get("modelo") ?? "",
    ano: dados.get("ano") ?? "",
    cor: dados.get("cor") ?? "",
    chassi: dados.get("chassi") ?? "",
    renavam: dados.get("renavam") ?? "",
    km: dados.get("km") ?? "",
    observacoes: dados.get("observacoes") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const payload = {
    clienteId: v.clienteId,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano ? Number(v.ano) || null : null,
    cor: vazioParaNulo(v.cor),
    chassi: vazioParaNulo(v.chassi),
    renavam: vazioParaNulo(v.renavam),
    km: v.km ? Number(v.km.replace(/\D/g, "")) || null : null,
    observacoes: vazioParaNulo(v.observacoes),
  };

  try {
    if (id) await prisma.veiculo.update({ where: { id }, data: payload });
    else await prisma.veiculo.create({ data: payload });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { erro: "Esta placa já está cadastrada em outro cliente." };
    }
    return { erro: "Não foi possível salvar o veículo." };
  }

  revalidatePath(`/sistema/clientes/${v.clienteId}`);
  return { ok: "Veículo salvo." };
}

export async function alternarAtivoClienteAction(id: string) {
  await exigirModulo("clientes");
  const c = await prisma.cliente.findUnique({ where: { id } });
  if (!c) return;
  await prisma.cliente.update({ where: { id }, data: { ativo: !c.ativo } });
  revalidatePath("/sistema/clientes");
  revalidatePath(`/sistema/clientes/${id}`);
}
