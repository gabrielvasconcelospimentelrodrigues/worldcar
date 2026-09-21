import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * Supabase Storage para as fotos das vistorias.
 *
 * O bucket e privado: o que fica salvo no banco e o caminho do arquivo, e as
 * URLs de exibicao sao assinadas na hora. Assim nenhuma foto de veiculo de
 * cliente fica acessivel por link publico.
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "vistorias";
const VALIDADE_URL = 60 * 60; // 1 hora

export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const TAMANHO_MAX = 8 * 1024 * 1024; // 8 MB por foto
export const MAX_FOTOS_POR_VISTORIA = 30;

let cliente: SupabaseClient | null = null;

/** null quando o Storage nao foi configurado — o sistema segue funcionando sem fotos. */
function obterCliente(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;

  cliente ??= createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export function storageConfigurado() {
  return obterCliente() !== null;
}

/**
 * Foto de celular chega com 3-6 MB e 4000px de largura. Guardar isso cru
 * consome o storage rapido e deixa a galeria lenta, sem ganho nenhum: 1600px
 * ja preserva o detalhe que importa numa discussao sobre avaria.
 * `rotate()` sem argumento aplica a orientacao do EXIF — sem isso, foto tirada
 * em pe chega deitada.
 */
const LARGURA_ARMAZENAMENTO = 1600;
const QUALIDADE_ARMAZENAMENTO = 82;

/** No PDF a foto aparece num quadro de ~78pt: 700px sobra. */
const LARGURA_PDF = 700;
const QUALIDADE_PDF = 70;

async function normalizar(entrada: Buffer, largura: number, qualidade: number) {
  return sharp(entrada)
    .rotate()
    .resize({ width: largura, withoutEnlargement: true })
    .jpeg({ quality: qualidade, mozjpeg: true })
    .toBuffer();
}

export type ResultadoUpload =
  | { ok: true; caminho: string }
  | { ok: false; erro: string };

export async function enviarFoto(
  vistoriaId: string,
  arquivo: File,
): Promise<ResultadoUpload> {
  const sb = obterCliente();
  if (!sb) {
    return {
      ok: false,
      erro: "Storage não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    };
  }

  if (!TIPOS_IMAGEM.includes(arquivo.type)) {
    return { ok: false, erro: `"${arquivo.name}": formato não aceito (use JPG, PNG ou WEBP).` };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return {
      ok: false,
      erro: `"${arquivo.name}": ${(arquivo.size / 1024 / 1024).toFixed(1)} MB excede o limite de 8 MB.`,
    };
  }

  // Tudo vira JPEG normalizado: simplifica o resto do sistema e corta o peso.
  let corpo: Buffer;
  try {
    corpo = await normalizar(
      Buffer.from(await arquivo.arrayBuffer()),
      LARGURA_ARMAZENAMENTO,
      QUALIDADE_ARMAZENAMENTO,
    );
  } catch {
    return { ok: false, erro: `"${arquivo.name}": não foi possível ler esta imagem.` };
  }

  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const caminho = `${vistoriaId}/${nome}`;

  const { error } = await sb.storage.from(BUCKET).upload(caminho, corpo, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    const faltaBucket = /bucket not found/i.test(error.message);
    return {
      ok: false,
      erro: faltaBucket
        ? `O bucket "${BUCKET}" não existe no Supabase. Crie-o em Storage (pode ser privado).`
        : `Falha ao enviar "${arquivo.name}": ${error.message}`,
    };
  }

  return { ok: true, caminho };
}

export async function removerFoto(caminho: string) {
  const sb = obterCliente();
  if (!sb) return;
  await sb.storage.from(BUCKET).remove([caminho]);
}

/** URL assinada para exibir a foto. null se o Storage estiver fora. */
export async function urlAssinada(caminho: string): Promise<string | null> {
  const sb = obterCliente();
  if (!sb) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_URL);
  return data?.signedUrl ?? null;
}

export async function urlsAssinadas(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const sb = obterCliente();
  if (!sb || caminhos.length === 0) return mapa;

  const { data } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_URL);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

/**
 * Baixa a foto como data URL, para embutir no PDF.
 * O @react-pdf/renderer nao lida bem com URLs assinadas remotas, e um data URL
 * garante que o documento continue valido depois que a assinatura expirar.
 */
export async function fotoComoDataUrl(caminho: string): Promise<string | null> {
  const sb = obterCliente();
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(caminho);
    if (error || !data) return null;
    // Reduz de novo para o tamanho de exibicao no PDF: embutir a foto inteira
    // gera documento de dezenas de MB, impossivel de mandar por WhatsApp.
    const buffer = await normalizar(
      Buffer.from(await data.arrayBuffer()),
      LARGURA_PDF,
      QUALIDADE_PDF,
    );
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Todas as fotos da vistoria entram no PDF: num laudo de avarias, omitir foto
 * enfraquece o documento. Cabem porque cada uma e reduzida para 700px antes de
 * ser embutida — as 30 somam cerca de 3 MB, bem abaixo do limite do WhatsApp.
 */
export const MAX_FOTOS_NO_PDF = MAX_FOTOS_POR_VISTORIA;
/** Rede de seguranca: se algo escapar do redimensionamento, o PDF nao explode. */
const ORCAMENTO_BYTES_PDF = 12 * 1024 * 1024;

export type FotoEmbutida = { dataUrl: string; legenda: string | null };

/**
 * Prepara as fotos para o PDF respeitando um teto de quantidade e de bytes.
 * Uma vistoria pode ter ate 30 fotos; embutir todas em tamanho original geraria
 * um PDF de dezenas de MB, pesado demais para renderizar em funcao serverless e
 * para o cliente receber por WhatsApp. As demais seguem no sistema.
 */
export async function fotosParaPdf(
  fotos: { caminho: string; legenda: string | null }[],
): Promise<{ embutidas: FotoEmbutida[]; omitidas: number }> {
  const embutidas: FotoEmbutida[] = [];
  let bytes = 0;

  for (const foto of fotos.slice(0, MAX_FOTOS_NO_PDF)) {
    const dataUrl = await fotoComoDataUrl(foto.caminho);
    if (!dataUrl) continue; // foto sumiu do bucket: segue sem ela
    if (bytes + dataUrl.length > ORCAMENTO_BYTES_PDF && embutidas.length > 0) break;
    bytes += dataUrl.length;
    embutidas.push({ dataUrl, legenda: foto.legenda });
  }

  return { embutidas, omitidas: Math.max(0, fotos.length - embutidas.length) };
}
