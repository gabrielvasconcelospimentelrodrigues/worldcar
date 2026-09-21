import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Perfil } from "./supabase";
import type { Modulo } from "./permissoes";
import type { MembroEquipe } from "./tipos";

/**
 * Contexto e hook ficam separados do provedor porque o Fast Refresh do Vite so
 * atualiza um arquivo em tempo real quando ele exporta apenas componentes.
 */

export type EstadoSessao = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  /** Ficha resumida do funcionario ligado ao login, se houver. */
  eu: MembroEquipe | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  pode: (modulo: Modulo) => boolean;
};

export const ContextoSessao = createContext<EstadoSessao | null>(null);

export function useSessao() {
  const ctx = useContext(ContextoSessao);
  if (!ctx) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>");
  return ctx;
}
