/**
 * Tabela FIPE — preenchimento assistido de marca, modelo e ano.
 *
 * API publica e gratuita (parallelum.com.br), sem chave. Nao consulta placa:
 * isso exigiria servico pago, e a chave nao poderia viver no navegador. O que
 * ela resolve e o erro de digitacao e a falta de padrao nos nomes — dois carros
 * cadastrados como "corolla" e "Corola XEI" viram registros diferentes na hora
 * de buscar o historico do cliente.
 */

const BASE = "https://parallelum.com.br/fipe/api/v1";

export type TipoVeiculoFipe = "carros" | "motos" | "caminhoes";

export const TIPOS_FIPE: { valor: TipoVeiculoFipe; rotulo: string }[] = [
  { valor: "carros", rotulo: "Carro" },
  { valor: "motos", rotulo: "Moto" },
  { valor: "caminhoes", rotulo: "Caminhão" },
];

export type ItemFipe = { codigo: string; nome: string };

/**
 * Cache em memoria. As tabelas da FIPE mudam uma vez por mes; dentro de uma
 * sessao de trabalho nao ha motivo para pedir a mesma lista duas vezes.
 */
const cache = new Map<string, ItemFipe[]>();

async function buscar(caminho: string): Promise<ItemFipe[]> {
  const guardado = cache.get(caminho);
  if (guardado) return guardado;

  const resposta = await fetch(`${BASE}/${caminho}`);
  if (!resposta.ok) throw new Error("A tabela FIPE não respondeu. Tente de novo.");

  const bruto: unknown = await resposta.json();
  // A API devolve array direto para marcas e anos, mas { modelos: [...] } para modelos
  const lista = Array.isArray(bruto)
    ? bruto
    : ((bruto as { modelos?: unknown[] }).modelos ?? []);

  const itens: ItemFipe[] = (lista as { codigo: unknown; nome: unknown }[]).map((i) => ({
    codigo: String(i.codigo),
    nome: String(i.nome),
  }));

  cache.set(caminho, itens);
  return itens;
}

export function marcas(tipo: TipoVeiculoFipe) {
  return buscar(`${tipo}/marcas`);
}

export function modelos(tipo: TipoVeiculoFipe, marca: string) {
  return buscar(`${tipo}/marcas/${marca}/modelos`);
}

export function anos(tipo: TipoVeiculoFipe, marca: string, modelo: string) {
  return buscar(`${tipo}/marcas/${marca}/modelos/${modelo}/anos`);
}

/**
 * "2023 Gasolina" -> 2023. Modelo zero-km aparece como "32000" na FIPE,
 * que significa o ano seguinte ao da tabela; nesse caso devolve o ano atual.
 */
export function anoDoRotulo(rotulo: string): number | null {
  const n = Number(rotulo.slice(0, 4));
  if (!Number.isFinite(n)) return null;
  if (n > 3000) return new Date().getFullYear();
  return n >= 1900 && n <= new Date().getFullYear() + 1 ? n : null;
}

/** "2023 Gasolina" -> "Gasolina" */
export function combustivelDoRotulo(rotulo: string): string | null {
  const resto = rotulo.slice(4).trim();
  return resto || null;
}
