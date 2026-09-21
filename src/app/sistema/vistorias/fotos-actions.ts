"use server";

import { revalidatePath } from "next/cache";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_FOTOS_POR_VISTORIA,
  enviarFoto,
  removerFoto,
  storageConfigurado,
} from "@/lib/storage";

export type EstadoFotos = { erro?: string; ok?: string };

export async function enviarFotosAction(
  _estado: EstadoFotos,
  dados: FormData,
): Promise<EstadoFotos> {
  await exigirModulo("vistorias");

  const vistoriaId = String(dados.get("vistoriaId") ?? "");
  if (!vistoriaId) return { erro: "Vistoria não informada." };

  if (!storageConfigurado()) {
    return {
      erro: "Envio de fotos indisponível: configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    };
  }

  const vistoria = await prisma.vistoria.findUnique({
    where: { id: vistoriaId },
    include: { _count: { select: { fotos: true } } },
  });
  if (!vistoria) return { erro: "Vistoria não encontrada." };

  const arquivos = dados
    .getAll("fotos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (arquivos.length === 0) return { erro: "Selecione ao menos uma foto." };

  const espaco = MAX_FOTOS_POR_VISTORIA - vistoria._count.fotos;
  if (espaco <= 0) {
    return { erro: `Esta vistoria já tem o máximo de ${MAX_FOTOS_POR_VISTORIA} fotos.` };
  }
  if (arquivos.length > espaco) {
    return {
      erro: `Cabem mais ${espaco} foto(s) nesta vistoria; você selecionou ${arquivos.length}.`,
    };
  }

  const legenda = String(dados.get("legenda") ?? "").trim();
  const enviadas: string[] = [];
  const falhas: string[] = [];

  for (const arquivo of arquivos) {
    const r = await enviarFoto(vistoriaId, arquivo);
    if (r.ok) enviadas.push(r.caminho);
    else falhas.push(r.erro);
  }

  if (enviadas.length > 0) {
    await prisma.vistoriaFoto.createMany({
      data: enviadas.map((caminho) => ({
        vistoriaId,
        caminho,
        legenda: legenda || null,
      })),
    });
    revalidatePath(`/sistema/vistorias/${vistoriaId}`);
  }

  if (falhas.length > 0) {
    // Sobe o que deu certo e conta o que não deu, em vez de descartar tudo.
    return {
      erro:
        enviadas.length > 0
          ? `${enviadas.length} foto(s) enviada(s). Falhas: ${falhas.join(" ")}`
          : falhas.join(" "),
    };
  }

  return { ok: `${enviadas.length} foto(s) anexada(s) à vistoria.` };
}

export async function removerFotoAction(dados: FormData) {
  await exigirModulo("vistorias");

  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const foto = await prisma.vistoriaFoto.findUnique({ where: { id } });
  if (!foto) return;

  // Apaga o registro mesmo se o arquivo já tiver sumido do bucket.
  await removerFoto(foto.caminho);
  await prisma.vistoriaFoto.delete({ where: { id } });

  revalidatePath(`/sistema/vistorias/${foto.vistoriaId}`);
}
