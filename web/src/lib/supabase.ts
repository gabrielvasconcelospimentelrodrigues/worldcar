import { createClient } from "@supabase/supabase-js";
import type { Papel } from "./tipos";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chave) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env.local",
  );
}

/**
 * Cliente unico do Supabase.
 *
 * A chave anon viaja no pacote do navegador — isso e esperado. Quem decide o
 * que cada pessoa alcanca sao as politicas de RLS no banco, nao o sigilo desta
 * chave. Ver supabase/migracoes/002_rls.sql.
 */
export const sb = createClient(url, chave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Perfil do usuario logado, lido da tabela `perfis`. */
export type Perfil = {
  id: string;
  papel: Papel;
  funcionario_id: string | null;
  ativo: boolean;
};

export async function carregarPerfil(usuarioId: string): Promise<Perfil | null> {
  const { data, error } = await sb
    .from("perfis")
    .select("id, papel, funcionario_id, ativo")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Perfil;
}

/**
 * Traduz o erro do Postgres para uma frase que faz sentido na tela.
 * 42501 e a negativa da RLS; P0001 vem dos `raise exception` das nossas
 * funcoes de negocio e ja chega em portugues.
 */
export function mensagemErro(erro: unknown): string {
  if (!erro) return "";
  const e = erro as { code?: string; message?: string; details?: string };

  if (e.code === "42501") {
    return "Você não tem permissão para esta ação.";
  }
  if (e.code === "23505") {
    return "Já existe um registro com esse valor único (documento, placa ou código).";
  }
  if (e.code === "23503") {
    return "Este registro está vinculado a outro e não pode ser removido.";
  }
  if (e.code === "PGRST116") {
    return "Registro não encontrado.";
  }
  return e.message || "Não foi possível concluir a operação.";
}
