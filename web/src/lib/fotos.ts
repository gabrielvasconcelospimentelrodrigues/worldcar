import { sb } from "./supabase";
import { novoId } from "./consultas";
import type { VistoriaFoto } from "./tipos";

/**
 * Fotos da vistoria no Supabase Storage.
 *
 * Diferenca importante em relacao ao sistema anterior: o redimensionamento
 * acontecia no servidor com `sharp`. Aqui nao ha servidor, entao a reducao
 * acontece no proprio aparelho, com canvas — o que e ate melhor, porque a foto
 * de 4 MB nem chega a subir pela rede da oficina.
 */

const BUCKET = "vistorias";
export const MAX_FOTOS = 30;
export const TAMANHO_MAX = 8 * 1024 * 1024;
const LARGURA_MAX = 1600;
const QUALIDADE = 0.82;
const VALIDADE_URL = 60 * 60;

/** Reduz para no maximo 1600px de largura e devolve um JPEG. */
export async function reduzir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LARGURA_MAX / bitmap.width);
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/jpeg", QUALIDADE),
  );
  if (!blob) throw new Error("Não foi possível converter a imagem.");
  return blob;
}

export type ResultadoEnvio = { ok: true; caminho: string } | { ok: false; erro: string };

export async function enviarFoto(vistoriaId: string, arquivo: File): Promise<ResultadoEnvio> {
  if (!arquivo.type.startsWith("image/")) {
    return { ok: false, erro: `"${arquivo.name}": não é uma imagem.` };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return {
      ok: false,
      erro: `"${arquivo.name}": ${(arquivo.size / 1024 / 1024).toFixed(1)} MB excede o limite de 8 MB.`,
    };
  }

  let corpo: Blob;
  try {
    corpo = await reduzir(arquivo);
  } catch {
    return { ok: false, erro: `"${arquivo.name}": não foi possível ler esta imagem.` };
  }

  const caminho = `${vistoriaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(caminho, corpo, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    const faltaBucket = /bucket not found/i.test(error.message);
    return {
      ok: false,
      erro: faltaBucket
        ? `O bucket "${BUCKET}" não existe no Supabase.`
        : `Falha ao enviar "${arquivo.name}": ${error.message}`,
    };
  }
  return { ok: true, caminho };
}

export async function registrarFotos(
  vistoriaId: string,
  caminhos: string[],
  legenda: string | null,
) {
  if (caminhos.length === 0) return;
  await sb.from("vistoria_fotos").insert(
    caminhos.map((caminho) => ({
      id: novoId(),
      vistoriaId,
      caminho,
      legenda: legenda?.trim() || null,
    })),
  );
}

export async function removerFoto(foto: VistoriaFoto) {
  await sb.storage.from(BUCKET).remove([foto.caminho]);
  await sb.from("vistoria_fotos").delete().eq("id", foto.id);
}

/** URLs assinadas de curta duracao — o bucket e privado. */
export async function urlsAssinadas(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (caminhos.length === 0) return mapa;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_URL);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

/** Baixa e reduz para 700px, para embutir no PDF. */
export async function fotoParaPdf(caminho: string): Promise<string | null> {
  try {
    const { data } = await sb.storage.from(BUCKET).download(caminho);
    if (!data) return null;
    const bitmap = await createImageBitmap(data);
    const escala = Math.min(1, 700 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
