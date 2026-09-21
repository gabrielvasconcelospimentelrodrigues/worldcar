import { sb } from "./supabase";
import type {
  Cliente, Empresa, MembroEquipe, Servico, Veiculo,
} from "./tipos";

/**
 * Consultas reaproveitadas por varias telas.
 * Ficam juntas para o formato do `select` do PostgREST nao se espalhar.
 */

export type ClienteComVeiculos = Pick<
  Cliente, "id" | "nome" | "telefone" | "descontoPct"
> & {
  veiculos: Pick<Veiculo, "id" | "placa" | "marca" | "modelo" | "km">[];
};

/** Clientes ativos com seus veiculos, para os seletores de orcamento e OS. */
export async function clientesComVeiculos(): Promise<ClienteComVeiculos[]> {
  const { data } = await sb
    .from("clientes")
    .select("id, nome, telefone, descontoPct, veiculos(id, placa, marca, modelo, km)")
    .eq("ativo", true)
    .order("nome");
  return (data as ClienteComVeiculos[]) ?? [];
}

/** Catalogo ativo, ordenado por categoria e nome. */
export async function catalogoAtivo(): Promise<Servico[]> {
  const { data } = await sb
    .from("servicos")
    .select("*")
    .eq("ativo", true)
    .order("categoria")
    .order("nome");
  return (data as Servico[]) ?? [];
}

/** Equipe ativa pela visao publica — sem salario nem CPF. */
export async function equipeAtiva(): Promise<MembroEquipe[]> {
  const { data } = await sb
    .from("equipe")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  return (data as MembroEquipe[]) ?? [];
}

/** Dados da empresa para o cabecalho dos PDFs. */
export async function dadosEmpresa(): Promise<Empresa | null> {
  const { data } = await sb.from("empresa").select("*").eq("id", "default").maybeSingle();
  return (data as Empresa) ?? null;
}

/** Agrupa o catalogo por categoria, para os <optgroup> dos seletores. */
export function porCategoria(servicos: Servico[]) {
  const mapa = new Map<string, Servico[]>();
  for (const s of servicos) {
    const lista = mapa.get(s.categoria) ?? [];
    lista.push(s);
    mapa.set(s.categoria, lista);
  }
  return [...mapa.entries()];
}

/** id novo no mesmo formato dos que ja existem no banco. */
export function novoId() {
  return crypto.randomUUID();
}

export function agora() {
  return new Date().toISOString();
}
