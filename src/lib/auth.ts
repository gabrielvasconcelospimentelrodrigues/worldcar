import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Papel } from "@prisma/client";
import { prisma } from "./prisma";
import { podeAcessar, type Modulo, type Sessao } from "./permissoes";

export type { Sessao } from "./permissoes";

const COOKIE = "wc_session";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET nao configurado (.env.local)");
  return new TextEncoder().encode(s);
}

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}

export async function criarSessao(sessao: Sessao) {
  const token = await new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function lerSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Sessao;
  } catch {
    return null;
  }
}

/** Garante sessao valida em Server Components e Server Actions. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await lerSessao();
  if (!s) throw new Error("NAO_AUTENTICADO");
  return s;
}

/** Garante que o usuario logado pode acessar o modulo. */
export async function exigirModulo(modulo: Modulo): Promise<Sessao> {
  const s = await exigirSessao();
  if (!podeAcessar(s.papel, modulo)) throw new Error("SEM_PERMISSAO");
  return s;
}

export async function exigirPapel(...papeis: Papel[]): Promise<Sessao> {
  const s = await exigirSessao();
  if (!papeis.includes(s.papel)) throw new Error("SEM_PERMISSAO");
  return s;
}

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { funcionario: true },
  });
  if (!usuario || !usuario.ativo) return null;
  if (!(await conferirSenha(senha, usuario.senhaHash))) return null;

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });

  return {
    usuarioId: usuario.id,
    email: usuario.email,
    papel: usuario.papel,
    funcionarioId: usuario.funcionario?.id ?? null,
    nome: usuario.funcionario?.nome ?? usuario.email,
  };
}
