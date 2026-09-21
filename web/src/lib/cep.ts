/**
 * Consulta de CEP pelo ViaCEP — publica, gratuita e sem chave.
 *
 * Preenche logradouro, bairro, cidade e UF. O numero e o complemento a API nao
 * tem como saber; por isso, depois de preencher, o foco vai para o campo numero.
 */

const BASE = "https://viacep.com.br/ws";

export type EnderecoCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ResultadoCep =
  | { ok: true; endereco: EnderecoCep }
  | { ok: false; erro: string };

/** Mantem so os digitos: aceita "81230-170", "81230170" ou "81.230-170". */
export function digitosCep(valor: string) {
  return valor.replace(/\D/g, "").slice(0, 8);
}

/** 81230170 -> 81230-170 */
export function formatarCep(valor: string) {
  const d = digitosCep(valor);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cepCompleto(valor: string) {
  return digitosCep(valor).length === 8;
}

/** Evita repetir a consulta do mesmo CEP durante a sessao. */
const cache = new Map<string, EnderecoCep>();

export async function buscarCep(valor: string): Promise<ResultadoCep> {
  const cep = digitosCep(valor);
  if (cep.length !== 8) return { ok: false, erro: "O CEP precisa ter 8 dígitos." };

  const guardado = cache.get(cep);
  if (guardado) return { ok: true, endereco: guardado };

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/${cep}/json/`);
  } catch {
    return { ok: false, erro: "Sem conexão para consultar o CEP. Preencha à mão." };
  }

  if (!resposta.ok) return { ok: false, erro: "CEP inválido." };

  const dados = (await resposta.json()) as {
    erro?: string | boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };

  // O ViaCEP responde 200 com { erro: "true" } quando o CEP nao existe
  if (dados.erro) return { ok: false, erro: "CEP não encontrado." };

  const endereco: EnderecoCep = {
    cep: formatarCep(cep),
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  };

  cache.set(cep, endereco);
  return { ok: true, endereco };
}
