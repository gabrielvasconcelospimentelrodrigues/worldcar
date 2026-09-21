/**
 * Mascaras de digitacao.
 *
 * Separado de `format.ts` de proposito: aquele formata para EXIBIR (recebe o
 * valor pronto do banco), este formata ENQUANTO se digita e precisa lidar com
 * valor pela metade — "(41) 9" tem de ser um estado valido, senao o campo
 * briga com quem esta digitando.
 *
 * Todas guardam so digitos/letras no banco; a pontuacao e enfeite de tela.
 */

/** Tira tudo que nao e digito. */
export const soDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * Placa: maiuscula sempre, sem pontuacao no meio.
 *
 * Aceita os dois padroes que circulam no Brasil — o antigo ABC1234 e o
 * Mercosul ABC1D23 — porque a oficina atende carro velho e carro novo no mesmo
 * dia. A 5a posicao e o unico ponto em que diferem: digito no antigo, letra no
 * Mercosul. Por isso ela aceita os dois e nao forca nenhum.
 */
export function mascararPlaca(v: string) {
  const limpo = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  let saida = "";
  for (const c of limpo) {
    // A posicao vem do tamanho da SAIDA, nao do indice da entrada: um caractere
    // recusado nao pode empurrar o proximo para a casa errada.
    const pos = saida.length;
    if (pos < 3) { if (/[A-Z]/.test(c)) saida += c; }       // 3 letras
    else if (pos === 3) { if (/\d/.test(c)) saida += c; }    // 1 digito
    else if (pos === 4) { saida += c; }                      // letra OU digito
    else if (/\d/.test(c)) saida += c;                       // 2 digitos
  }
  return saida;
}

/** Exibe a placa com hifen: ABC1D23 -> ABC-1D23 */
export function placaComHifen(v: string) {
  const p = mascararPlaca(v);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function placaValida(v: string) {
  const p = mascararPlaca(v);
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);
}

/** (41) 99999-0000 — cresce conforme se digita, aceita fixo e celular. */
export function mascararTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CPF ate 11 digitos, CNPJ a partir dai — decide sozinho pelo tamanho. */
export function mascararDocumento(v: string) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** 80000-000 */
export function mascararCep(v: string) {
  const d = soDigitos(v).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Dinheiro: os digitos entram pela direita, como em maquininha de cartao.
 * Digitar 1,2,5,0 mostra 0,01 -> 0,12 -> 1,25 -> 12,50. E o jeito que nao exige
 * do balconista pensar onde fica a virgula.
 */
export function mascararDinheiro(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" -> 1234.56 — o caminho de volta, para gravar. */
export function dinheiroParaNumero(v: string) {
  const d = soDigitos(v);
  return d ? Number(d) / 100 : 0;
}

/** 12.345 km */
export function mascararInteiro(v: string) {
  const d = soDigitos(v).slice(0, 9);
  return d ? Number(d).toLocaleString("pt-BR") : "";
}

/** Nome proprio: "JOAO da SILVA" -> "Joao da Silva". */
export function mascararNome(v: string) {
  const menores = new Set(["da", "de", "do", "das", "dos", "e"]);
  return v.toLowerCase().replace(/\s+/g, " ").split(" ")
    .map((p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}
