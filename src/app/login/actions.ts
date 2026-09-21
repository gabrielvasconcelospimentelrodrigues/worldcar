"use server";

import { redirect } from "next/navigation";
import { autenticar, criarSessao, encerrarSessao } from "@/lib/auth";

export type EstadoLogin = { erro?: string };

export async function entrarAction(
  _estado: EstadoLogin,
  dados: FormData,
): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "");
  const senha = String(dados.get("senha") ?? "");
  const de = String(dados.get("de") ?? "/sistema");

  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  let sessao;
  try {
    sessao = await autenticar(email, senha);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("AUTH_SECRET")) {
      return { erro: "AUTH_SECRET nao configurado no .env.local." };
    }
    return {
      erro: "Nao foi possivel conectar ao banco de dados. Verifique o .env.local.",
    };
  }

  if (!sessao) return { erro: "E-mail ou senha incorretos." };

  await criarSessao(sessao);
  redirect(de.startsWith("/sistema") ? de : "/sistema");
}

export async function sairAction() {
  await encerrarSessao();
  redirect("/login");
}
