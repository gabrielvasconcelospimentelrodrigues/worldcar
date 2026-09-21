import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageCircle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { exigirModulo } from "@/lib/auth";
import {
  Badge,
  BotaoLink,
  Cartao,
  CabecalhoCartao,
  Dado,
  LinhaVazia,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { STATUS_OS, STATUS_ORCAMENTO } from "@/lib/constantes";
import { brl, data, documento, linkWhatsapp, numeroDoc, telefone } from "@/lib/format";
import { FormularioCliente } from "../formulario-cliente";
import { FormularioVeiculo } from "./formulario-veiculo";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModulo("clientes");
  const { id } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      veiculos: { orderBy: { criadoEm: "desc" } },
      orcamentos: {
        include: { veiculo: true },
        orderBy: { criadoEm: "desc" },
        take: 10,
      },
      ordens: {
        include: { veiculo: true },
        orderBy: { dataEntrada: "desc" },
        take: 10,
      },
    },
  });

  if (!cliente) notFound();

  const totalGasto = cliente.ordens
    .filter((o) => o.status === "ENTREGUE")
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <>
      <TituloPagina
        titulo={cliente.nome}
        descricao={`${cliente.tipo === "JURIDICA" ? "Pessoa jurídica" : "Pessoa física"}${
          cliente.documento ? ` · ${documento(cliente.documento)}` : ""
        }`}
        acao={
          <>
            <a
              href={linkWhatsapp(
                cliente.telefone,
                `Olá ${cliente.nome.split(" ")[0]}, aqui é da World Car Service.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
            <BotaoLink href={`/sistema/orcamentos/novo?cliente=${cliente.id}`}>
              <Plus className="h-4 w-4" aria-hidden />
              Novo orçamento
            </BotaoLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Coluna esquerda: resumo + cadastro */}
        <div className="space-y-6">
          <Cartao className="p-5">
            <dl className="grid grid-cols-2 gap-4">
              <Dado rotulo="Telefone">{telefone(cliente.telefone)}</Dado>
              <Dado rotulo="Telefone 2">
                {cliente.telefone2 ? telefone(cliente.telefone2) : "—"}
              </Dado>
              <Dado rotulo="E-mail">{cliente.email ?? "—"}</Dado>
              <Dado rotulo="Cliente desde">{data(cliente.criadoEm)}</Dado>
              <Dado rotulo="Endereço">
                {cliente.endereco
                  ? `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}`
                  : "—"}
              </Dado>
              <Dado rotulo="Cidade">
                {cliente.cidade ? `${cliente.cidade}/${cliente.uf ?? ""}` : "—"}
              </Dado>
              <Dado rotulo="Serviços concluídos">
                {cliente.ordens.filter((o) => o.status === "ENTREGUE").length}
              </Dado>
              <Dado rotulo="Total gasto">
                <span className="font-bold text-carvao-950">{brl(totalGasto)}</span>
              </Dado>
            </dl>
            {cliente.observacoes && (
              <div className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">
                  {cliente.observacoes}
                </p>
              </div>
            )}
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Dados cadastrais" descricao="Edite e salve" />
            <FormularioCliente cliente={cliente} />
          </Cartao>
        </div>

        {/* Coluna direita: veiculos + historico */}
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao
              titulo="Veículos"
              descricao={`${cliente.veiculos.length} cadastrado(s)`}
            />
            <ul className="divide-y divide-carvao-100">
              {cliente.veiculos.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-carvao-500">
                  Nenhum veículo cadastrado.
                </li>
              )}
              {cliente.veiculos.map((v) => (
                <li key={v.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-carvao-950">
                        {v.marca} {v.modelo}
                        {v.ano ? ` · ${v.ano}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-carvao-500">
                        {v.cor ?? "Cor não informada"}
                        {v.km ? ` · ${v.km.toLocaleString("pt-BR")} km` : ""}
                      </p>
                    </div>
                    <Badge cor="bg-carvao-950 text-white">{v.placa}</Badge>
                  </div>
                  {v.observacoes && (
                    <p className="mt-2 text-xs text-carvao-600">{v.observacoes}</p>
                  )}
                </li>
              ))}
            </ul>
            <FormularioVeiculo clienteId={cliente.id} />
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Ordens de serviço" descricao="Últimas 10" />
            <Tabela>
              <thead>
                <tr>
                  <Th>OS</Th>
                  <Th>Veículo</Th>
                  <Th>Entrada</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {cliente.ordens.length === 0 && (
                  <LinhaVazia colunas={5} mensagem="Nenhuma OS registrada." />
                )}
                {cliente.ordens.map((o) => (
                  <tr key={o.id} className="hover:bg-carvao-50">
                    <Td>
                      <Link
                        href={`/sistema/ordens/${o.id}`}
                        className="font-semibold text-marca-600 hover:underline"
                      >
                        {numeroDoc(o.numero)}
                      </Link>
                    </Td>
                    <Td className="text-carvao-600">{o.veiculo.placa}</Td>
                    <Td className="whitespace-nowrap text-carvao-600">
                      {data(o.dataEntrada)}
                    </Td>
                    <Td>
                      <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
                    </Td>
                    <Td className="text-right font-semibold">{brl(o.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Orçamentos" descricao="Últimos 10" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Veículo</Th>
                  <Th>Data</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {cliente.orcamentos.length === 0 && (
                  <LinhaVazia colunas={5} mensagem="Nenhum orçamento registrado." />
                )}
                {cliente.orcamentos.map((o) => (
                  <tr key={o.id} className="hover:bg-carvao-50">
                    <Td>
                      <Link
                        href={`/sistema/orcamentos/${o.id}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-marca-600 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {numeroDoc(o.numero)}
                      </Link>
                    </Td>
                    <Td className="text-carvao-600">{o.veiculo.placa}</Td>
                    <Td className="whitespace-nowrap text-carvao-600">{data(o.criadoEm)}</Td>
                    <Td>
                      <Badge cor={STATUS_ORCAMENTO[o.status].cor}>
                        {STATUS_ORCAMENTO[o.status].label}
                      </Badge>
                    </Td>
                    <Td className="text-right font-semibold">{brl(o.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </div>
      </div>
    </>
  );
}
