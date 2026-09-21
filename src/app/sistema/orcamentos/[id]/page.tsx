import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Download, FileText, MessageCircle, Pencil } from "lucide-react";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Aviso,
  Badge,
  BotaoLink,
  Cartao,
  CabecalhoCartao,
  Dado,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { STATUS_ORCAMENTO } from "@/lib/constantes";
import { brl, data, linkWhatsapp, num, numeroDoc, telefone } from "@/lib/format";
import { funcionariosAtivos } from "../consultas";
import { AcoesOrcamento } from "./acoes";

export const dynamic = "force-dynamic";

export default async function OrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModulo("orcamentos");
  const { id } = await params;

  const [orc, funcionarios] = await Promise.all([
    prisma.orcamento.findUnique({
      where: { id },
      include: {
        cliente: true,
        veiculo: true,
        vendedor: true,
        ordem: true,
        itens: { include: { servico: true }, orderBy: { ordem: "asc" } },
      },
    }),
    funcionariosAtivos(),
  ]);

  if (!orc) notFound();

  const rotulo = STATUS_ORCAMENTO[orc.status];
  const mensagemZap = `Olá ${orc.cliente.nome.split(" ")[0]}! Segue o orçamento ${numeroDoc(
    orc.numero,
  )} da World Car Service para o ${orc.veiculo.marca} ${orc.veiculo.modelo} (${
    orc.veiculo.placa
  }): ${brl(num(orc.total))}. Válido até ${data(orc.validoAte)}.`;

  return (
    <>
      <TituloPagina
        titulo={`Orçamento ${numeroDoc(orc.numero)}`}
        descricao={`${orc.cliente.nome} · ${orc.veiculo.marca} ${orc.veiculo.modelo} (${orc.veiculo.placa})`}
        acao={
          <>
            <a
              href={`/sistema/orcamentos/${orc.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-carvao-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-carvao-800"
            >
              <FileText className="h-4 w-4" aria-hidden />
              PDF (3 vias)
            </a>
            <a
              href={`/sistema/orcamentos/${orc.id}/pdf?download=1`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Baixar
            </a>
            <a
              href={linkWhatsapp(orc.cliente.telefone, mensagemZap)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Enviar
            </a>
            {orc.status !== "CONVERTIDO" && (
              <BotaoLink href={`/sistema/orcamentos/${orc.id}/editar`} variante="fantasma">
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </BotaoLink>
            )}
          </>
        }
      />

      {orc.ordem && (
        <div className="mb-4">
          <Aviso tipo="sucesso">
            Este orçamento virou a{" "}
            <Link
              href={`/sistema/ordens/${orc.ordem.id}`}
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              OS {numeroDoc(orc.ordem.numero)}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            .
          </Aviso>
        </div>
      )}

      {orc.status === "RECUSADO" && orc.motivoRecusa && (
        <div className="mb-4">
          <Aviso tipo="erro">
            <strong>Motivo da recusa:</strong> {orc.motivoRecusa}
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao
              titulo="Serviços orçados"
              acao={<Badge cor={rotulo.cor}>{rotulo.label}</Badge>}
            />
            <Tabela>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th className="text-center">Garantia</Th>
                  <Th className="text-center">Qtd</Th>
                  <Th className="text-right">Valor un.</Th>
                  <Th className="text-right">Desc.</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {orc.itens.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <p className="font-medium text-carvao-950">{i.descricao}</p>
                      {i.servico?.descricao && (
                        <p className="mt-0.5 text-xs text-carvao-500">
                          {i.servico.descricao}
                        </p>
                      )}
                    </Td>
                    <Td className="text-center text-carvao-600">
                      {i.servico?.garantiaDias ? `${i.servico.garantiaDias}d` : "—"}
                    </Td>
                    <Td className="text-center">{num(i.quantidade)}</Td>
                    <Td className="text-right">{brl(i.precoUnit)}</Td>
                    <Td className="text-right text-marca-600">
                      {num(i.desconto) > 0 ? `− ${brl(i.desconto)}` : "—"}
                    </Td>
                    <Td className="text-right font-semibold">{brl(i.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>

            <dl className="flex flex-col items-end gap-1 border-t border-carvao-200 bg-carvao-50 p-5 text-sm">
              <div className="flex w-56 justify-between">
                <dt className="text-carvao-600">Subtotal</dt>
                <dd className="font-medium">{brl(orc.subtotal)}</dd>
              </div>
              <div className="flex w-56 justify-between">
                <dt className="text-carvao-600">
                  Desconto
                  {orc.descontoTipo === "PERCENTUAL" ? ` (${num(orc.desconto)}%)` : ""}
                </dt>
                <dd className="font-medium text-marca-600">
                  − {brl(num(orc.subtotal) - num(orc.total))}
                </dd>
              </div>
              <div className="mt-1 flex w-56 items-center justify-between border-t border-carvao-300 pt-2">
                <dt className="font-bold uppercase text-carvao-950">Total</dt>
                <dd className="font-display text-2xl font-extrabold text-carvao-950">
                  {brl(orc.total)}
                </dd>
              </div>
            </dl>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Ações" />
            <div className="p-5">
              <AcoesOrcamento
                id={orc.id}
                status={orc.status}
                funcionarios={funcionarios}
              />
            </div>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              Dados do documento
            </h2>
            <dl className="space-y-3">
              <Dado rotulo="Cliente">
                <Link
                  href={`/sistema/clientes/${orc.clienteId}`}
                  className="font-semibold text-marca-600 hover:underline"
                >
                  {orc.cliente.nome}
                </Link>
              </Dado>
              <Dado rotulo="Telefone">{telefone(orc.cliente.telefone)}</Dado>
              <Dado rotulo="Veículo">
                {orc.veiculo.marca} {orc.veiculo.modelo}
                {orc.veiculo.ano ? ` ${orc.veiculo.ano}` : ""} · {orc.veiculo.placa}
              </Dado>
              <Dado rotulo="KM">
                {orc.kmVeiculo ? orc.kmVeiculo.toLocaleString("pt-BR") : "—"}
              </Dado>
              <Dado rotulo="Emitido em">{data(orc.criadoEm)}</Dado>
              <Dado rotulo="Válido até">{data(orc.validoAte)}</Dado>
              <Dado rotulo="Prazo de execução">
                {orc.prazoEntregaDias ? `${orc.prazoEntregaDias} dia(s) útil(eis)` : "A combinar"}
              </Dado>
              <Dado rotulo="Forma de pagamento">{orc.formaPagamento ?? "A combinar"}</Dado>
              <Dado rotulo="Vendedor">{orc.vendedor?.nome ?? "—"}</Dado>
              {orc.aprovadoEm && <Dado rotulo="Aprovado em">{data(orc.aprovadoEm)}</Dado>}
            </dl>

            {orc.observacoes && (
              <div className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">
                  {orc.observacoes}
                </p>
              </div>
            )}
          </Cartao>

          <Cartao className="p-5">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              Vias do PDF
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-carvao-600">
              <li>
                <strong className="text-carvao-900">Via da loja</strong> — arquivo
                interno, com todos os valores.
              </li>
              <li>
                <strong className="text-carvao-900">Via da produção</strong> — para a
                equipe técnica, sem valores.
              </li>
              <li>
                <strong className="text-carvao-900">Via do cliente</strong> — com campo
                de assinatura de aprovação.
              </li>
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
