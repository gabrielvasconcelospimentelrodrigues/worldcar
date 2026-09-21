import { useEffect, useState } from "react";
import { equipeAtiva } from "./consultas";
import { sb } from "./supabase";
import type { MembroEquipe } from "./tipos";

/**
 * Cache da equipe em memoria.
 *
 * As telas precisam trocar id por nome ("recebido por", "responsavel") o tempo
 * todo. Nao da para embutir isso no select do PostgREST: a RLS de `funcionarios`
 * so libera a propria ficha para o tecnico, e privilegio por coluna nao separa
 * tecnico de gerente — os dois sao o mesmo papel no banco. Entao a lista vem da
 * visao `equipe` (sem salario nem CPF) e o cruzamento acontece aqui.
 */

let cache: MembroEquipe[] | null = null;
let carregando: Promise<MembroEquipe[]> | null = null;
const ouvintes = new Set<(e: MembroEquipe[]) => void>();

async function buscar(): Promise<MembroEquipe[]> {
  // `equipeAtiva` traz so quem esta ativo; a ficha de uma OS antiga pode
  // apontar para alguem ja desligado, por isso aqui vem todo mundo.
  const { data } = await sb.from("equipe").select("*").order("nome");
  cache = (data as MembroEquipe[]) ?? [];
  for (const o of ouvintes) o(cache);
  return cache;
}

export function carregarEquipe(): Promise<MembroEquipe[]> {
  if (cache) return Promise.resolve(cache);
  carregando ??= buscar().finally(() => { carregando = null; });
  return carregando;
}

/** Forca nova leitura — usar depois de cadastrar ou desligar alguem. */
export function limparCacheEquipe() {
  cache = null;
}

export function useEquipe() {
  const [equipe, setEquipe] = useState<MembroEquipe[]>(cache ?? []);

  useEffect(() => {
    let vivo = true;
    ouvintes.add(setEquipe);
    void carregarEquipe().then((e) => { if (vivo) setEquipe(e); });
    return () => {
      vivo = false;
      ouvintes.delete(setEquipe);
    };
  }, []);

  const nome = (id: string | null | undefined) =>
    id ? (equipe.find((f) => f.id === id)?.nome ?? "—") : "—";

  const membro = (id: string | null | undefined) =>
    id ? equipe.find((f) => f.id === id) : undefined;

  return { equipe, ativos: equipe.filter((f) => f.ativo), nome, membro };
}

export { equipeAtiva };
