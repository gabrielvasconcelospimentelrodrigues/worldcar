"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirModulo, exigirPapel, hashSenha } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/negocio";

export type Estado = { erro?: string; ok?: string };

const funcionarioSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo."),
  matricula: z.string().trim().min(1, "Informe a matrícula."),
  cpf: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  email: z.union([z.string().trim().email("E-mail inválido."), z.literal("")]),
  cargo: z.string().trim().min(2, "Informe o cargo."),
  setor: z.enum([
    "LAVAGEM",
    "FUNILARIA",
    "PINTURA",
    "ESTETICA",
    "PELICULA",
    "MECANICA",
    "ADMINISTRATIVO",
  ]),
  admissao: z.string().min(1, "Informe a data de admissão."),
  salario: z.coerce.number().min(0),
  comissaoPct: z.coerce.number().min(0).max(100, "Comissão máxima é 100%."),
  observacoes: z.string().trim().max(1000).optional(),
});

export async function salvarFuncionarioAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("rh");

  const id = String(dados.get("id") ?? "");
  const r = funcionarioSchema.safeParse({
    nome: dados.get("nome") ?? "",
    matricula: dados.get("matricula") ?? "",
    cpf: dados.get("cpf") ?? "",
    telefone: dados.get("telefone") ?? "",
    email: dados.get("email") ?? "",
    cargo: dados.get("cargo") ?? "",
    setor: dados.get("setor") ?? "ADMINISTRATIVO",
    admissao: dados.get("admissao") ?? "",
    salario: dados.get("salario") ?? 0,
    comissaoPct: dados.get("comissaoPct") ?? 0,
    observacoes: dados.get("observacoes") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const payload = {
    nome: v.nome,
    matricula: v.matricula.toUpperCase(),
    cpf: v.cpf?.replace(/\D/g, "") || null,
    telefone: v.telefone?.trim() || null,
    email: v.email || null,
    cargo: v.cargo,
    setor: v.setor,
    admissao: new Date(`${v.admissao}T12:00:00`),
    salario: dec(v.salario),
    comissaoPct: dec(v.comissaoPct),
    observacoes: v.observacoes?.trim() || null,
  };

  try {
    if (id) await prisma.funcionario.update({ where: { id }, data: payload });
    else await prisma.funcionario.create({ data: payload });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { erro: "Já existe um funcionário com esta matrícula ou CPF." };
    }
    return { erro: "Não foi possível salvar o funcionário." };
  }

  revalidatePath("/sistema/rh");
  return { ok: id ? "Funcionário atualizado." : "Funcionário cadastrado." };
}

export async function alternarAtivoFuncionarioAction(dados: FormData) {
  await exigirModulo("rh");
  const id = String(dados.get("id") ?? "");
  const f = await prisma.funcionario.findUnique({ where: { id } });
  if (!f) return;

  await prisma.funcionario.update({
    where: { id },
    data: { ativo: !f.ativo, demissao: f.ativo ? new Date() : null },
  });
  revalidatePath("/sistema/rh");
}

const ocorrenciaSchema = z.object({
  funcionarioId: z.string().min(1, "Selecione o funcionário."),
  tipo: z.enum([
    "FERIAS",
    "FALTA",
    "ATESTADO",
    "ADVERTENCIA",
    "SUSPENSAO",
    "TREINAMENTO",
    "ELOGIO",
    "OUTRO",
  ]),
  inicio: z.string().min(1, "Informe a data de início."),
  fim: z.string().optional(),
  descricao: z.string().trim().max(1000).optional(),
});

export async function salvarOcorrenciaAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirModulo("rh");

  const r = ocorrenciaSchema.safeParse({
    funcionarioId: dados.get("funcionarioId") ?? "",
    tipo: dados.get("tipo") ?? "OUTRO",
    inicio: dados.get("inicio") ?? "",
    fim: dados.get("fim") ?? "",
    descricao: dados.get("descricao") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  if (v.fim && v.fim < v.inicio) {
    return { erro: "A data final não pode ser anterior à inicial." };
  }

  await prisma.ocorrenciaRH.create({
    data: {
      funcionarioId: v.funcionarioId,
      tipo: v.tipo,
      inicio: new Date(`${v.inicio}T12:00:00`),
      fim: v.fim ? new Date(`${v.fim}T12:00:00`) : null,
      descricao: v.descricao?.trim() || null,
    },
  });

  revalidatePath("/sistema/rh");
  return { ok: "Ocorrência registrada." };
}

export async function excluirOcorrenciaAction(dados: FormData) {
  await exigirModulo("rh");
  const id = String(dados.get("id") ?? "");
  if (!id) return;
  await prisma.ocorrenciaRH.delete({ where: { id } });
  revalidatePath("/sistema/rh");
}

/* ------------------------------------------------------------
   Acesso ao sistema (somente ADMIN)
   ------------------------------------------------------------ */

const acessoSchema = z.object({
  funcionarioId: z.string().min(1),
  email: z.string().trim().email("E-mail inválido."),
  senha: z.string().min(6, "A senha precisa ter ao menos 6 caracteres."),
  papel: z.enum(["ADMIN", "GERENTE", "ATENDENTE", "TECNICO"]),
});

export async function criarAcessoAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  await exigirPapel("ADMIN");

  const r = acessoSchema.safeParse({
    funcionarioId: dados.get("funcionarioId") ?? "",
    email: dados.get("email") ?? "",
    senha: dados.get("senha") ?? "",
    papel: dados.get("papel") ?? "ATENDENTE",
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: v.funcionarioId },
    include: { usuario: true },
  });
  if (!funcionario) return { erro: "Funcionário não encontrado." };

  const senhaHash = await hashSenha(v.senha);
  const email = v.email.toLowerCase();

  try {
    if (funcionario.usuario) {
      await prisma.usuario.update({
        where: { id: funcionario.usuario.id },
        data: { email, senhaHash, papel: v.papel, ativo: true },
      });
    } else {
      const usuario = await prisma.usuario.create({
        data: { email, senhaHash, papel: v.papel },
      });
      await prisma.funcionario.update({
        where: { id: v.funcionarioId },
        data: { usuarioId: usuario.id },
      });
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { erro: "Este e-mail já está em uso por outro usuário." };
    }
    return { erro: "Não foi possível criar o acesso." };
  }

  revalidatePath("/sistema/rh");
  return { ok: `Acesso liberado para ${funcionario.nome}.` };
}

export async function revogarAcessoAction(dados: FormData) {
  await exigirPapel("ADMIN");
  const usuarioId = String(dados.get("usuarioId") ?? "");
  if (!usuarioId) return;

  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!u) return;

  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: !u.ativo } });
  revalidatePath("/sistema/rh");
}
