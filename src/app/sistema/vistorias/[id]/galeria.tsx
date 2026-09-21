"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { Camera, Trash2, Upload } from "lucide-react";
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
} from "@/components/ui";
import { dataHora } from "@/lib/format";
import {
  enviarFotosAction,
  removerFotoAction,
  type EstadoFotos,
} from "../fotos-actions";

export type FotoItem = {
  id: string;
  src: string | null; // URL assinada; null se o Storage estiver fora
  legenda: string | null;
  criadoEm: Date;
};

function BotaoEnviar({ quantas }: { quantas: number }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending || quantas === 0}>
      <Upload className="h-4 w-4" aria-hidden />
      {pending
        ? "Enviando..."
        : quantas === 0
          ? "Selecione as fotos"
          : `Enviar ${quantas} foto(s)`}
    </Botao>
  );
}

export function GaleriaVistoria({
  vistoriaId,
  fotos,
  editavel,
  storageAtivo,
}: {
  vistoriaId: string;
  fotos: FotoItem[];
  editavel: boolean;
  storageAtivo: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [quantas, setQuantas] = useState(0);
  const [ampliada, setAmpliada] = useState<FotoItem | null>(null);

  const [estado, acao] = useActionState<EstadoFotos, FormData>(
    async (prev, dados) => {
      const r = await enviarFotosAction(prev, dados);
      if (r.ok) {
        formRef.current?.reset();
        setQuantas(0);
      }
      return r;
    },
    {},
  );

  return (
    <>
      <Cartao>
        <CabecalhoCartao
          titulo="Fotos da vistoria"
          descricao={
            fotos.length > 0
              ? `${fotos.length} foto(s) anexada(s)`
              : "Registre o estado do veículo em imagem"
          }
        />

        {fotos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carvao-500">
            Nenhuma foto anexada a esta vistoria.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((f) => (
              <li key={f.id} className="group relative">
                <button
                  type="button"
                  onClick={() => f.src && setAmpliada(f)}
                  disabled={!f.src}
                  className="block w-full overflow-hidden rounded-lg border border-carvao-200 bg-carvao-100 disabled:cursor-default"
                  aria-label={`Ampliar foto${f.legenda ? `: ${f.legenda}` : ""}`}
                >
                  {f.src ? (
                    <Image
                      src={f.src}
                      alt={f.legenda ?? "Foto da vistoria"}
                      width={400}
                      height={300}
                      unoptimized
                      className="aspect-4/3 w-full object-cover transition group-hover:opacity-90"
                    />
                  ) : (
                    <span className="flex aspect-4/3 w-full items-center justify-center text-xs text-carvao-500">
                      imagem indisponível
                    </span>
                  )}
                </button>

                {f.legenda && (
                  <p className="mt-1 truncate text-xs text-carvao-600">{f.legenda}</p>
                )}
                <p className="text-[10px] text-carvao-400">{dataHora(f.criadoEm)}</p>

                {editavel && (
                  <form action={removerFotoAction} className="absolute right-1.5 top-1.5">
                    <input type="hidden" name="id" value={f.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-carvao-950/70 p-1.5 text-white opacity-0 transition hover:bg-marca-600 focus:opacity-100 group-hover:opacity-100"
                      aria-label="Remover foto"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {editavel && (
          <form
            ref={formRef}
            action={acao}
            className="space-y-4 border-t border-carvao-200 bg-carvao-50 p-5"
          >
            <input type="hidden" name="vistoriaId" value={vistoriaId} />

            {!storageAtivo && (
              <Aviso tipo="erro">
                Storage não configurado. Preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
                <code>SUPABASE_SERVICE_ROLE_KEY</code> no <code>.env.local</code> e crie um
                bucket privado chamado <code>vistorias</code>.
              </Aviso>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="fotos"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600"
                >
                  Fotos
                </label>
                <label
                  htmlFor="fotos"
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-carvao-400 bg-white px-4 py-3 text-sm text-carvao-600 transition hover:border-marca-500 hover:text-marca-600"
                >
                  <Camera className="h-5 w-5 shrink-0" aria-hidden />
                  {quantas > 0
                    ? `${quantas} arquivo(s) selecionado(s)`
                    : "Tirar foto ou escolher do aparelho"}
                </label>
                <input
                  id="fotos"
                  name="fotos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  disabled={!storageAtivo}
                  onChange={(e) => setQuantas(e.target.files?.length ?? 0)}
                  className="sr-only"
                />
                <p className="mt-1 text-xs text-carvao-500">
                  JPG, PNG ou WEBP · até 8 MB cada
                </p>
              </div>

              <Campo
                rotulo="Legenda (aplicada a todas)"
                name="legenda"
                placeholder="Para-choque traseiro, risco lateral..."
                disabled={!storageAtivo}
              />
            </div>

            {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
            {estado.ok && <Aviso tipo="sucesso">{estado.ok}</Aviso>}

            <BotaoEnviar quantas={quantas} />
          </form>
        )}
      </Cartao>

      {/* Visualizador ampliado */}
      {ampliada?.src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={ampliada.legenda ?? "Foto da vistoria"}
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setAmpliada(null)}
            aria-label="Fechar"
          />
          <figure className="relative max-h-full max-w-4xl">
            <Image
              src={ampliada.src}
              alt={ampliada.legenda ?? "Foto da vistoria"}
              width={1600}
              height={1200}
              unoptimized
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <figcaption className="mt-3 text-center text-sm text-white">
              {ampliada.legenda ?? "Sem legenda"}
              <span className="block text-xs text-carvao-400">
                {dataHora(ampliada.criadoEm)}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
