import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClipboardCheck,
  Download,
  FileText,
  LogIn,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Cartao,
  CabecalhoCartao,
  Dado,
  TituloPagina,
} from "@/components/ui";
import { STATUS_OS } from "@/lib/constantes";
import { TRANSICOES_OS } from "@/lib/negocio";
import { brl, data, dataHora, linkWhatsapp, num, numeroDoc, telefone } from "@/lib/format";
import { funcionariosAtivos, opcoesDoEditor } from "../../orcamentos/consultas";
import { PainelItens } from "./painel-itens";
import { PainelSaida } from "./painel-saida";

export const dynamic = "force-dynamic";

export default async function OrdemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModulo("ordens");
  const { id } = await params;

  const [ordem, funcionarios, { servicos }] = await Promise.all([
    prisma.ordemServico.findUnique({
      where: { id },
      include: {
        cliente: true,
        veiculo: true,
        orcamento: true,
        funcionarioEntrada: true,
        funcionarioSaida: true,
        itens: { orderBy: { id: "asc" } },
        vistorias: { include: { funcionario: true }, orderBy: { data: "asc" } },
        lancamentos: true,
        comissoes: { include: { funcionario: true } },
      },
    }),
    funcionariosAtivos(),
    opcoesDoEditor(),
  ]);

  if (!ordem) notFound();

  const editavel = !["ENTREGUE", "CANCELADA"].includes(ordem.status);
  const pendencias = ordem.itens.filter(
    (i) => i.status !== "CONCLUIDO" && i.status !== "CANCELADO",
  ).length;
  const vistoriaEntrada = ordem.vistorias.find((v) => v.tipo === "ENTRADA");
  const vistoriaSaida = ordem.vistorias.find((v) => v.tipo === "SAIDA");

  const zap = `Olá ${ordem.cliente.nome.split(" ")[0]}! Seu ${ordem.veiculo.marca} ${
    ordem.veiculo.modelo
  } (${ordem.veiculo.placa}) — OS ${numeroDoc(ordem.numero)} — está ${
    ordem.status === "PRONTA" ? "pronto para retirada" : "em atendimento na World Car Service"
  }.`;

  return (
    <>
      <TituloPagina
        titulo={`OS ${numeroDoc(ordem.numero)}`}
        descricao={`${ordem.cliente.nome} · ${ordem.veiculo.marca} ${ordem.veiculo.modelo} (${ordem.veiculo.placa})`}
        acao={
          <>
            <a
              href={`/sistema/ordens/${ordem.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-carvao-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-carvao-800"
            >
              <FileText className="h-4 w-4" aria-hidden />
              PDF (3 vias)
            </a>
            <a
              href={`/sistema/ordens/${ordem.id}/pdf?download=1`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Baixar
            </a>
            <a
              href={linkWhatsapp(ordem.cliente.telefone, zap)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Avisar cliente
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <PainelItens
            ordemId={ordem.id}
            editavel={editavel}
            funcionarios={funcionarios}
            servicos={servicos}
            itens={ordem.itens.map((i) => ({
              id: i.id,
              descricao: i.descricao,
              quantidade: num(i.quantidade),
              precoUnit: num(i.precoUnit),
              total: num(i.total),
              status: i.status,
              responsavelId: i.responsavelId,
              iniciadoEm: i.iniciadoEm,
              concluidoEm: i.concluidoEm,
              garantiaDias: i.garantiaDias,
            }))}
          />

          <PainelSaida
            ordemId={ordem.id}
            status={ordem.status}
            total={num(ordem.total)}
            clienteNome={ordem.cliente.nome}
            kmEntrada={ordem.kmEntrada}
            funcionarios={funcionarios}
            transicoes={TRANSICOES_OS[ordem.status]}
            temVistoriaSaida={Boolean(vistoriaSaida)}
            pendencias={pendencias}
          />

          {/* Vistorias */}
          <Cartao>
            <CabecalhoCartao
              titulo="Vistorias"
              descricao="Estado do veículo na entrada e na saída"
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {(
                [
                  ["ENTRADA", vistoriaEntrada, LogIn] as const,
                  ["SAIDA", vistoriaSaida, LogOut] as const,
                ]
              ).map(([tipo, v, Icone]) => (
                <div
                  key={tipo}
                  className={`rounded-lg border p-4 ${
                    v ? "border-emerald-200 bg-emerald-50" : "border-carvao-200 bg-carvao-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icone className="h-4 w-4 text-carvao-600" aria-hidden />
                    <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                      {tipo === "ENTRADA" ? "Vistoria de entrada" : "Vistoria de saída"}
                    </h3>
                  </div>
                  {v ? (
                    <>
                      <p className="mt-2 text-sm text-carvao-700">
                        {dataHora(v.data)} · {v.funcionario.nome}
                      </p>
                      <Link
                        href={`/sistema/vistorias/${v.id}`}
                        className="mt-2 inline-block text-sm font-semibold text-marca-600 hover:underline"
                      >
                        Ver laudo
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-carvao-600">Ainda não registrada.</p>
                      {editavel && (
                        <Link
                          href={`/sistema/vistorias/nova?ordem=${ordem.id}&tipo=${tipo}`}
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 hover:underline"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                          Registrar agora
                        </Link>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </Cartao>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Cartao className="p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
                Resumo
              </h2>
              <Badge cor={STATUS_OS[ordem.status].cor}>
                {STATUS_OS[ordem.status].label}
              </Badge>
            </div>
            <dl className="space-y-3">
              <Dado rotulo="Cliente">
                <Link
                  href={`/sistema/clientes/${ordem.clienteId}`}
                  className="font-semibold text-marca-600 hover:underline"
                >
                  {ordem.cliente.nome}
                </Link>
              </Dado>
              <Dado rotulo="Telefone">{telefone(ordem.cliente.telefone)}</Dado>
              <Dado rotulo="Veículo">
                {ordem.veiculo.marca} {ordem.veiculo.modelo} · {ordem.veiculo.placa}
              </Dado>
              {ordem.orcamento && (
                <Dado rotulo="Origem">
                  <Link
                    href={`/sistema/orcamentos/${ordem.orcamento.id}`}
                    className="font-semibold text-marca-600 hover:underline"
                  >
                    Orçamento {numeroDoc(ordem.orcamento.numero)}
                  </Link>
                </Dado>
              )}
              <Dado rotulo="Previsão de entrega">
                {ordem.previsaoEntrega ? data(ordem.previsaoEntrega) : "A definir"}
              </Dado>
              <Dado rotulo="Total">
                <span className="font-display text-xl font-extrabold text-carvao-950">
                  {brl(ordem.total)}
                </span>
              </Dado>
            </dl>
          </Cartao>

          {/* Entrada */}
          <Cartao className="p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <LogIn className="h-4 w-4 text-marca-500" aria-hidden />
              Entrada
            </h2>
            <dl className="space-y-3">
              <Dado rotulo="Data e hora">{dataHora(ordem.dataEntrada)}</Dado>
              <Dado rotulo="Recebido por">
                <span className="font-semibold">{ordem.funcionarioEntrada.nome}</span>
                <span className="block text-xs text-carvao-500">
                  {ordem.funcionarioEntrada.cargo}
                </span>
              </Dado>
              <Dado rotulo="KM">
                {ordem.kmEntrada ? ordem.kmEntrada.toLocaleString("pt-BR") : "—"}
              </Dado>
              <Dado rotulo="Combustível">{ordem.combustivelEntrada ?? "—"}</Dado>
              {ordem.observacoesEntrada && (
                <Dado rotulo="Observações">
                  <span className="whitespace-pre-wrap">{ordem.observacoesEntrada}</span>
                </Dado>
              )}
            </dl>
          </Cartao>

          {/* Saida */}
          <Cartao className="p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <LogOut className="h-4 w-4 text-marca-500" aria-hidden />
              Saída
            </h2>
            {ordem.dataSaida ? (
              <dl className="space-y-3">
                <Dado rotulo="Data e hora">{dataHora(ordem.dataSaida)}</Dado>
                <Dado rotulo="Entregue por">
                  <span className="font-semibold">{ordem.funcionarioSaida?.nome ?? "—"}</span>
                  <span className="block text-xs text-carvao-500">
                    {ordem.funcionarioSaida?.cargo ?? ""}
                  </span>
                </Dado>
                <Dado rotulo="Retirado por">
                  {ordem.clienteRetirou ?? "—"}
                  {ordem.documentoRetirada && (
                    <span className="block text-xs text-carvao-500">
                      Doc. {ordem.documentoRetirada}
                    </span>
                  )}
                </Dado>
                <Dado rotulo="KM">
                  {ordem.kmSaida ? ordem.kmSaida.toLocaleString("pt-BR") : "—"}
                </Dado>
                {ordem.observacoesSaida && (
                  <Dado rotulo="Observações">
                    <span className="whitespace-pre-wrap">{ordem.observacoesSaida}</span>
                  </Dado>
                )}
                {ordem.assinaturaEntrega && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                      Assinatura de recebimento
                    </dt>
                    <dd className="mt-1">
                      {/* dataURL gravado no banco; next/image não acrescenta nada aqui */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ordem.assinaturaEntrega}
                        alt={`Assinatura de ${ordem.clienteRetirou ?? ordem.cliente.nome}`}
                        className="h-20 w-full rounded-md border border-carvao-200 bg-white object-contain p-1"
                      />
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-carvao-500">
                Veículo ainda na oficina. A saída é registrada no painel ao lado.
              </p>
            )}
          </Cartao>

          {/* Comissoes geradas */}
          {ordem.comissoes.length > 0 && (
            <Cartao className="p-5">
              <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
                Comissões
              </h2>
              <ul className="space-y-2 text-sm">
                {ordem.comissoes.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="text-carvao-700">
                      {c.funcionario.nome}
                      <span className="block text-xs text-carvao-500">
                        {num(c.percentual)}% de {brl(c.baseCalculo)}
                      </span>
                    </span>
                    <span className="font-bold text-carvao-950">{brl(c.valor)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
