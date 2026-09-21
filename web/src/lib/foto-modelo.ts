/**
 * Foto do modelo do veiculo, a partir da marca e do modelo.
 *
 * Por que nao pela placa: nenhuma base publica liga placa a foto do carro
 * individual. As APIs pagas de placa devolvem marca, modelo, ano, cor, chassi —
 * texto, nunca imagem. E a FIPE, que ja usamos, devolve nove campos e nenhum
 * deles e imagem: ela e tabela de preco.
 *
 * Por que Wikipedia e nao um servico de render: o imagin.studio, o mais citado,
 * so entrega render com contrato pago — a chave de demonstracao devolve a mesma
 * imagem-placeholder para qualquer carro (verificado: Corolla, Ferrari 488 e uma
 * marca inexistente deram o mesmo arquivo, byte a byte).
 *
 * O que isto entrega e uma foto GENERICA DO MODELO, as vezes da versao de outro
 * mercado. Quem mostra o carro do cliente e a vistoria de entrada.
 *
 * Sobre ano e cor, medido no acervo do Commons:
 *   "Toyota Etios 2019"   -> fotos exatas do modelo e do ano
 *   "Toyota Etios"        -> pior: traz o painel e a versao indonesia
 *   "Toyota Etios branco" -> zero resultados
 * Ou seja: o ano melhora muito e entra na busca; a cor nao funciona, porque os
 * arquivos nao sao nomeados em portugues. Por isso a cor nao e usada — prometer
 * um filtro de cor que nao filtra seria pior do que nao ter filtro nenhum.
 *
 * Google Imagens nao e opcao: a resposta nao traz cabecalho CORS, entao o
 * navegador busca e descarta antes de o codigo ler. So daria com servidor
 * intermediario, que esta arquitetura nao tem.
 */
import { sb } from "./supabase";

const API_PT = "https://pt.wikipedia.org/w/api.php";
const API_EN = "https://en.wikipedia.org/w/api.php";
const LARGURA = 800;

export type FotoModelo = {
  url: string;
  autor: string | null;
  licenca: string | null;
  licencaUrl: string | null;
  paginaUrl: string | null;
};

/** 'Toyota' + ' Corolla XEI ' + 2019 -> 'toyota|corolla xei|2019' */
function chaveDe(marca: string, modelo: string, ano?: number | null) {
  const limpar = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  return `${limpar(marca)}|${limpar(modelo)}|${ano ?? ""}`;
}

const memoria = new Map<string, FotoModelo | null>();

function semTags(html: unknown) {
  const texto = String(html ?? "").replace(/<[^>]+>/g, "").trim();
  return texto || null;
}

/**
 * Descarta o que nao e foto de carro. A busca da Wikipedia costuma cair na
 * pagina da MARCA quando o modelo nao tem verbete — e ai a imagem principal e o
 * logotipo, ou a sede da empresa. Ja vi "Honda Civic" trazer o predio da Honda.
 */
function imagemImprestavel(url: string, tituloPagina: string, marca: string) {
  const u = url.toLowerCase();
  if (u.includes(".svg")) return true; // logo vetorial
  // Precisa casar a palavra inteira: sem as fronteiras, "icon" casa dentro de
  // "Renault_Kwid_Iconic" — uma versao de acabamento — e descarta a foto certa.
  const arquivo = u.split("/").pop() ?? "";
  if (/(^|[_\-.])(logos?|emblems?|wordmarks?|badges?|icons?)([_\-.]|$)/.test(arquivo)) return true;
  const t = tituloPagina.trim().toLowerCase();
  const m = marca.trim().toLowerCase();
  return t === m || t === `${m} motor` || t === `${m} motors`;
}

const API_COMMONS = "https://commons.wikimedia.org/w/api.php";

type PaginaWiki = {
  title: string;
  index?: number;
  original?: { source: string };
  imageinfo?: { thumburl?: string; descriptionurl?: string;
    extmetadata?: Record<string, { value?: unknown }> }[];
};

/** Tira acento e caixa, para comparar titulo de arquivo com o que foi digitado. */
function simples(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Escolhe entre os resultados do Commons.
 *
 * Buscar "Volkswagen Gol 2019" traz, entre outros, uma foto de prova de
 * arrancada cujo titulo tambem contem "Volkswagen Gol". A pontuacao prefere o
 * arquivo que comeca pelo nome do carro e que traz o ano, que na pratica e a
 * foto de catalogo e nao a foto de evento.
 */
function pontuar(titulo: string, marca: string, modelo: string, ano?: number | null) {
  const t = simples(titulo);
  const frase = simples(`${marca} ${modelo}`);
  const pos = t.indexOf(frase);
  if (pos < 0) return -1;
  let nota = 10 - Math.min(9, pos / 4);
  if (ano && t.includes(String(ano))) nota += 6;
  if (pos === 0) nota += 3;
  // Para identificar um carro no patio, a foto util e a de frente. Traseira,
  // interior e detalhe de motor servem para outra coisa.
  if (/\bfront\b|\bfrente\b|frontal/.test(t)) nota += 4;
  if (/\brear\b|\bback\b|traseir|interior|painel|dashboard|engine|motor\b|detail/.test(t)) {
    nota -= 5;
  }
  return nota;
}

async function pedir(api: string, params: Record<string, string>) {
  // origin=* e obrigatorio: sem ele o navegador barra a resposta por CORS.
  const busca = new URLSearchParams({ action: "query", format: "json", origin: "*", ...params });
  // A Wikimedia pede que clientes se identifiquem e limita mais quem nao o faz.
  // O navegador proibe mexer em User-Agent, mas a API aceita este cabecalho.
  const resposta = await fetch(`${api}?${busca}`, {
    headers: { "Api-User-Agent": "WorldCarService/1.0 (sistema de oficina)" },
  });
  if (!resposta.ok) throw new Error(String(resposta.status));
  return (await resposta.json()) as {
    query?: { pages?: Record<string, PaginaWiki & { imageinfo?: unknown[] }> };
  };
}

function paginas(dados: Awaited<ReturnType<typeof pedir>>) {
  return Object.values(dados.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 99) - (b.index ?? 99),
  );
}

/** Procura em um idioma: primeiro o titulo exato, depois a busca. */
async function procurarEm(api: string, marca: string, modelo: string) {
  const alvo = `${marca} ${modelo}`.trim();
  const tentativas: Record<string, string>[] = [
    { titles: alvo, prop: "pageimages", piprop: "original", redirects: "1" },
    {
      generator: "search", gsrsearch: alvo, gsrlimit: "5", gsrnamespace: "0",
      prop: "pageimages", piprop: "original",
    },
  ];
  for (const params of tentativas) {
    const dados = await pedir(api, params);
    for (const p of paginas(dados)) {
      const bruta = p.original?.source;
      if (!bruta) continue;
      // A URL vem com ?utm_source=... grudado; o nome do arquivo precisa sair limpo.
      const limpa = bruta.split("?")[0];
      if (imagemImprestavel(limpa, p.title, marca)) continue;
      return { arquivo: decodeURIComponent(limpa.split("/").pop() ?? ""), titulo: p.title, api };
    }
  }
  return null;
}

/** Busca no acervo de imagens do Commons, usando marca, modelo e ano. */
async function procurarNoCommons(marca: string, modelo: string, ano?: number | null) {
  const termo = [marca, modelo, ano].filter(Boolean).join(" ");
  const dados = await pedir(API_COMMONS, {
    generator: "search", gsrsearch: `${termo} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "8",
    prop: "imageinfo", iiprop: "extmetadata|url", iiurlwidth: String(LARGURA),
  });

  let melhor: { nota: number; pagina: PaginaWiki } | null = null;
  for (const pagina of paginas(dados)) {
    const nome = pagina.title.replace(/^File:/, "");
    if (imagemImprestavel(nome, pagina.title, marca)) continue;
    if (!pagina.imageinfo?.[0]?.thumburl) continue;
    const nota = pontuar(nome, marca, modelo, ano);
    if (nota < 0) continue;
    if (!melhor || nota > melhor.nota) melhor = { nota, pagina };
  }
  if (!melhor) return null;

  const info = melhor.pagina.imageinfo![0];
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl!.split("?")[0],
    autor: semTags(meta.Artist?.value),
    licenca: semTags(meta.LicenseShortName?.value),
    licencaUrl: semTags(meta.LicenseUrl?.value),
    paginaUrl: info.descriptionurl ?? null,
  } satisfies FotoModelo;
}

/** Miniatura + autor e licenca. */
async function detalhes(api: string, arquivo: string): Promise<FotoModelo | null> {
  const dados = await pedir(api, {
    titles: `File:${arquivo}`, prop: "imageinfo",
    iiprop: "extmetadata|url", iiurlwidth: String(LARGURA),
  });
  const info = paginas(dados)[0]?.imageinfo?.[0] as
    | { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: unknown }> }
    | undefined;
  if (!info?.thumburl) return null;
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl.split("?")[0],
    autor: semTags(meta.Artist?.value),
    licenca: semTags(meta.LicenseShortName?.value),
    licencaUrl: semTags(meta.LicenseUrl?.value),
    paginaUrl: info.descriptionurl ?? null,
  };
}

/**
 * Devolve a foto do modelo, ou null quando nao ha.
 *
 * Consulta o cache do banco antes da rede: a Wikipedia limita requisicoes por
 * origem e uma oficina cadastra o mesmo modelo muitas vezes. O cache guarda
 * tambem a busca vazia (url nula), senao um modelo sem verbete seria procurado
 * de novo a cada cadastro.
 */
export async function fotoDoModelo(
  marca: string, modelo: string, ano?: number | null,
): Promise<FotoModelo | null> {
  if (!marca.trim() || !modelo.trim()) return null;
  const chave = chaveDe(marca, modelo, ano);

  if (memoria.has(chave)) return memoria.get(chave) ?? null;

  const { data: guardado } = await sb
    .from("modelo_fotos").select("*").eq("chave", chave).maybeSingle();
  if (guardado) {
    const achado: FotoModelo | null = guardado.url
      ? {
          url: guardado.url, autor: guardado.autor, licenca: guardado.licenca,
          licencaUrl: guardado.licencaUrl, paginaUrl: guardado.paginaUrl,
        }
      : null;
    memoria.set(chave, achado);
    return achado;
  }

  let achado: FotoModelo | null = null;
  try {
    // O acervo de imagens vem primeiro porque aceita o ano; a imagem de topo do
    // artigo entra como reserva, que e o caminho que ja estava provado.
    achado = await procurarNoCommons(marca, modelo, ano);
    if (!achado) {
      const encontrado =
        (await procurarEm(API_PT, marca, modelo)) ?? (await procurarEm(API_EN, marca, modelo));
      if (encontrado) achado = await detalhes(encontrado.api, encontrado.arquivo);
    }
  } catch {
    // Rede fora ou 429: nao grava nada e nao quebra o cadastro. Foto e enfeite;
    // o veiculo precisa salvar de qualquer jeito.
    return null;
  }

  memoria.set(chave, achado);
  await sb.from("modelo_fotos").upsert({
    chave, marca: marca.trim(), modelo: modelo.trim(),
    url: achado?.url ?? null, autor: achado?.autor ?? null,
    licenca: achado?.licenca ?? null, licencaUrl: achado?.licencaUrl ?? null,
    paginaUrl: achado?.paginaUrl ?? null,
  });
  return achado;
}

/**
 * Origem da imagem. Nao aparece na tela — o uso e interno e ilustrativo, e foi
 * decidido nao exibir credito. Fica guardado porque custa zero e seria o que
 * faltaria caso um dia a foto va para um documento entregue ao cliente.
 */
export function creditoDe(foto: FotoModelo) {
  return [foto.autor, foto.licenca].filter(Boolean).join(" · ") || "Wikimedia Commons";
}
