import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Pencil } from "lucide-react";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  BotaoLink,
  Cartao,
  CabecalhoCartao,
  Dado,
  TituloPagina,
} from "@/components/ui";
import {
  CHECKLIST_VISTORIA,
  ESTADO_VISTORIA,
  type EstadoItemVistoria,
} from "@/lib/constantes";
import { dataHora, numeroDoc } from "@/lib/format";
import { storageConfigurado, urlsAssinadas } from "@/lib/storage";
import { GaleriaVistoria } from "./galeria";

export const dynamic = "force-dynamic";

type Avaria = { local: string; descricao: string; gravidade: string };

export default async function VistoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModulo("vistorias");
  const { id } = await params;

  const v = await prisma.vistoria.findUnique({
    where: { id },
    include: {
      funcionario: true,
      ordem: { include: { cliente: true, veiculo: true } },
      fotos: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!v) notFound();

  const checklist = (v.checklist ?? {}) as Record<string, EstadoItemVistoria>;
  const avarias = (Array.isArray(v.avarias) ? v.avarias : []) as unknown as Avaria[];
  const comAvaria = Object.entries(checklist).filter(([, e]) => e === "AVARIA");

  // Bucket privado: cada exibição usa uma URL assinada de curta duração.
  const assinadas = await urlsAssinadas(v.fotos.map((f) => f.caminho));
  const fotos = v.fotos.map((f) => ({
    id: f.id,
    src: assinadas.get(f.caminho) ?? null,
    legenda: f.legenda,
    criadoEm: f.criadoEm,
  }));
  // Depois que a OS é entregue o laudo vira histórico e não aceita mais anexos.
  const editavel = !["ENTREGUE", "CANCELADA"].includes(v.ordem.status);

  return (
    <>
      <TituloPagina
        titulo={`Vistoria de ${v.tipo === "ENTRADA" ? "entrada" : "saída"}`}
        descricao={`OS ${numeroDoc(v.ordem.numero)} · ${v.ordem.cliente.nome} · ${
          v.ordem.veiculo.marca
        } ${v.ordem.veiculo.modelo} (${v.ordem.veiculo.placa})`}
        acao={
          <>
            <a
              href={`/sistema/vistorias/${v.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-carvao-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-carvao-800"
            >
              <FileText className="h-4 w-4" aria-hidden />
              PDF (3 vias)
            </a>
            <a
              href={`/sistema/vistorias/${v.id}/pdf?download=1`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Baixar
            </a>
            <BotaoLink
              href={`/sistema/vistorias/nova?ordem=${v.ordemId}&tipo=${v.tipo}`}
              variante="fantasma"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Refazer
            </BotaoLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao
              titulo="Checklist"
              descricao={`${Object.keys(checklist).length} itens conferidos`}
            />
            <div className="divide-y divide-carvao-100">
              {CHECKLIST_VISTORIA.map((grupo) => (
                <section key={grupo.grupo} className="p-5">
                  <h3 className="mb-3 font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                    {grupo.grupo}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.itens.map((item) => {
                      const e = checklist[item];
                      return (
                        <li
                          key={item}
                          className="flex items-center justify-between gap-2 rounded-md border border-carvao-200 px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-carvao-800">
                            {item}
                          </span>
                          {e ? (
                            <Badge cor={ESTADO_VISTORIA[e].cor}>
                              {ESTADO_VISTORIA[e].label}
                            </Badge>
                          ) : (
                            <Badge cor="bg-carvao-100 text-carvao-400">
                              não conferido
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <CabecalhoCartao
              titulo="Avarias registradas"
              descricao={`${avarias.length} ocorrência(s)`}
            />
            {avarias.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-carvao-500">
                Nenhuma avaria registrada nesta vistoria.
              </p>
            ) : (
              <ul className="divide-y divide-carvao-100">
                {avarias.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <p className="font-semibold text-carvao-950">{a.local}</p>
                      {a.descricao && (
                        <p className="mt-0.5 text-sm text-carvao-600">{a.descricao}</p>
                      )}
                    </div>
                    <Badge
                      cor={
                        a.gravidade === "Grave"
                          ? "bg-marca-700 text-white"
                          : a.gravidade === "Média"
                            ? "bg-amber-600 text-white"
                            : "bg-carvao-200 text-carvao-800"
                      }
                    >
                      {a.gravidade}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <GaleriaVistoria
            vistoriaId={v.id}
            fotos={fotos}
            editavel={editavel}
            storageAtivo={storageConfigurado()}
          />
        </div>

        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              Dados da vistoria
            </h2>
            <dl className="space-y-3">
              <Dado rotulo="Tipo">
                <Badge
                  cor={
                    v.tipo === "ENTRADA"
                      ? "bg-blue-600 text-white"
                      : "bg-carvao-950 text-white"
                  }
                >
                  {v.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                </Badge>
              </Dado>
              <Dado rotulo="Data e hora">{dataHora(v.data)}</Dado>
              <Dado rotulo="Vistoriador">
                <span className="font-semibold">{v.funcionario.nome}</span>
                <span className="block text-xs text-carvao-500">
                  {v.funcionario.cargo}
                </span>
              </Dado>
              <Dado rotulo="KM">{v.km ? v.km.toLocaleString("pt-BR") : "—"}</Dado>
              <Dado rotulo="Combustível">{v.combustivel ?? "—"}</Dado>
              <Dado rotulo="Cliente conferiu">
                {v.aprovadaCliente ? (
                  <Badge cor="bg-emerald-600 text-white">Sim</Badge>
                ) : (
                  "Não registrado"
                )}
              </Dado>
              <Dado rotulo="Ordem de serviço">
                <Link
                  href={`/sistema/ordens/${v.ordemId}`}
                  className="font-semibold text-marca-600 hover:underline"
                >
                  OS {numeroDoc(v.ordem.numero)}
                </Link>
              </Dado>
            </dl>

            {v.pertences && (
              <div className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Pertences no veículo
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">
                  {v.pertences}
                </p>
              </div>
            )}

            {v.observacoes && (
              <div className="mt-3 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">
                  {v.observacoes}
                </p>
              </div>
            )}

            {v.assinaturaCliente && (
              <figure className="mt-3">
                <figcaption className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Assinatura do cliente
                </figcaption>
                {/* dataURL gravado no banco; next/image não acrescenta nada aqui */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.assinaturaCliente}
                  alt={`Assinatura de ${v.ordem.cliente.nome}`}
                  className="mt-1 h-20 w-full rounded-md border border-carvao-200 bg-white object-contain p-1"
                />
              </figure>
            )}
          </Cartao>

          {comAvaria.length > 0 && (
            <Cartao className="border-marca-200 p-5">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-marca-700">
                Itens marcados como avaria
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-carvao-700">
                {comAvaria.map(([item]) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
