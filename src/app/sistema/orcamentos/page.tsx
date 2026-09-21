import Link from "next/link";
import { Plus } from "lucide-react";
import type { StatusOrcamento } from "@prisma/client";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  BotaoLink,
  Cartao,
  LinhaVazia,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { STATUS_ORCAMENTO } from "@/lib/constantes";
import { brl, data, numeroDoc } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orçamentos" };

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
  { valor: "ENVIADO", rotulo: "Enviados" },
  { valor: "APROVADO", rotulo: "Aprovados" },
  { valor: "RECUSADO", rotulo: "Recusados" },
  { valor: "EXPIRADO", rotulo: "Expirados" },
  { valor: "CONVERTIDO", rotulo: "Convertidos" },
];

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await exigirModulo("orcamentos");
  const { status } = await searchParams;

  const valido = FILTROS.some((f) => f.valor === status && f.valor !== "");
  const orcamentos = await prisma.orcamento.findMany({
    where: valido ? { status: status as StatusOrcamento } : undefined,
    include: { cliente: true, veiculo: true, vendedor: true, _count: { select: { itens: true } } },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });

  const hoje = new Date();

  return (
    <>
      <TituloPagina
        titulo="Orçamentos"
        descricao="Toda proposta gera um PDF com vias para loja, produção e cliente."
        acao={
          <BotaoLink href="/sistema/orcamentos/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo orçamento
          </BotaoLink>
        }
      />

      <nav aria-label="Filtrar por status" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const ativo = (status ?? "") === f.valor;
          return (
            <Link
              key={f.rotulo}
              href={f.valor ? `/sistema/orcamentos?status=${f.valor}` : "/sistema/orcamentos"}
              className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
                ativo
                  ? "bg-carvao-950 text-white"
                  : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"
              }`}
            >
              {f.rotulo}
            </Link>
          );
        })}
      </nav>

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Cliente / veículo</Th>
              <Th>Vendedor</Th>
              <Th className="text-center">Itens</Th>
              <Th>Emissão</Th>
              <Th>Validade</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {orcamentos.length === 0 && (
              <LinhaVazia colunas={8} mensagem="Nenhum orçamento nesse filtro." />
            )}
            {orcamentos.map((o) => {
              const vencendo =
                o.validoAte >= hoje &&
                o.validoAte.getTime() - hoje.getTime() < 3 * 86400000 &&
                ["RASCUNHO", "ENVIADO"].includes(o.status);
              return (
                <tr key={o.id} className="hover:bg-carvao-50">
                  <Td>
                    <Link
                      href={`/sistema/orcamentos/${o.id}`}
                      className="font-semibold text-marca-600 hover:underline"
                    >
                      {numeroDoc(o.numero)}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">{o.cliente.nome}</p>
                    <p className="text-xs text-carvao-500">
                      {o.veiculo.marca} {o.veiculo.modelo} · {o.veiculo.placa}
                    </p>
                  </Td>
                  <Td className="text-carvao-600">{o.vendedor?.nome ?? "—"}</Td>
                  <Td className="text-center text-carvao-600">{o._count.itens}</Td>
                  <Td className="whitespace-nowrap text-carvao-600">{data(o.criadoEm)}</Td>
                  <Td className="whitespace-nowrap">
                    <span className={vencendo ? "font-semibold text-marca-600" : "text-carvao-600"}>
                      {data(o.validoAte)}
                    </span>
                  </Td>
                  <Td>
                    <Badge cor={STATUS_ORCAMENTO[o.status].cor}>
                      {STATUS_ORCAMENTO[o.status].label}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-bold text-carvao-950">
                    {brl(o.total)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
