/**
 * Contadores das bolinhas do menu lateral.
 *
 * Cada numero e "isto espera uma acao humana", nao o total do modulo — uma
 * bolinha que nunca zera para de ser aviso e vira enfeite. Quem decide o que
 * conta e a funcao `contadores_menu()` no banco, para o navegador nao precisar
 * disparar seis `count` a cada troca de tela.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { sb } from "./supabase";
import type { Modulo } from "./permissoes";

export type Contadores = Partial<Record<Modulo, number>>;

const INTERVALO = 60_000;

export function useContadores() {
  const [contadores, setContadores] = useState<Contadores>({});
  const { pathname } = useLocation();

  const recarregar = useCallback(async () => {
    const { data, error } = await sb.rpc("contadores_menu");
    if (error || !data) return;
    setContadores(data as Contadores);
  }, []);

  // Recarrega ao trocar de tela: quem acabou de resolver um alerta espera ver a
  // bolinha cair ao voltar para a lista, nao daqui a um minuto.
  useEffect(() => { void recarregar(); }, [recarregar, pathname]);

  useEffect(() => {
    const t = setInterval(() => { void recarregar(); }, INTERVALO);
    return () => clearInterval(t);
  }, [recarregar]);

  return { contadores, recarregar };
}
