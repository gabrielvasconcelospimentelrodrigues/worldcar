import Link from "next/link";
import { Plus } from "lucide-react";
import type { StatusOS } from "@prisma/client";
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
import { STATUS_OS } from "@/lib/constantes";
import { brl, data, numeroDoc } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordens de serviço" };

const FILTROS = [
  { valor: "ATIVAS", rotulo: "Na oficina" },
  { valor: "", rotulo: "Todas" },
  { valor: "AGUARDANDO", rotulo: "Aguardando" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "PRONTA", rotulo: "Prontas" },
  { valor: "ENTREGUE", rotulo: "Entregues" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
];

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await exigirModulo("ordens");
  const { status } = await searchParams;
  const filtro = status ?? "ATIVAS";

  const where =
    filtro === "ATIVAS"
      ? { status: { in: ["AGUARDANDO", "EM_ANDAMENTO", "PAUSADA", "PRONTA"] as StatusOS[] } }
      : filtro === ""
        ? undefined
        : { status: filtro as StatusOS };

  const ordens = await prisma.ordemServico.findMany({
    where,
    include: {
      cliente: true,
      veiculo: true,
      funcionarioEntrada: true,
      funcionarioSaida: true,
      itens: { select: { status: true } },
    },
    orderBy: [{ status: "asc" }, { dataEntrada: "desc" }],
    take: 100,
  });

  const agora = new Date();

  return (
    <>
      <TituloPagina
        titulo="Ordens de serviço"
        descricao="Entrada, execução e saída — cada etapa com o funcionário responsável."
        acao={
          <BotaoLink href="/sistema/ordens/nova">
            <Plus className="h-4 w-4" aria-hidden />
            Entrada de veículo
          </BotaoLink>
        }
      />

      <nav aria-label="Filtrar ordens" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <Link
              key={f.rotulo}
              href={f.valor ? `/sistema/ordens?status=${f.valor}` : "/sistema/ordens?status="}
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
              <Th>OS</Th>
              <Th>Cliente / veículo</Th>
              <Th>Entrada</Th>
              <Th>Saída</Th>
              <Th className="text-center">Progresso</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {ordens.length === 0 && (
              <LinhaVazia colunas={7} mensagem="Nenhuma ordem de serviço neste filtro." />
            )}
            {ordens.map((o) => {
              const total = o.itens.length;
              const feitos = o.itens.filter(
                (i) => i.status === "CONCLUIDO" || i.status === "CANCELADO",
              ).length;
              const atrasada =
                o.previsaoEntrega &&
                o.previsaoEntrega < agora &&
                !["ENTREGUE", "CANCELADA"].includes(o.status);

              return (
                <tr key={o.id} className="hover:bg-carvao-50">
                  <Td>
                    <Link
                      href={`/sistema/ordens/${o.id}`}
                      className="font-semibold text-marca-600 hover:underline"
                    >
                      {numeroDoc(o.numero)}
                    </Link>
                    {atrasada && (
                      <Badge cor="bg-marca-600 text-white" className="mt-1 block w-fit">
                        Atrasada
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">{o.cliente.nome}</p>
                    <p className="text-xs text-carvao-500">
                      {o.veiculo.marca} {o.veiculo.modelo} · {o.veiculo.placa}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-carvao-700">{data(o.dataEntrada)}</p>
                    <p className="text-xs text-carvao-500">
                      {o.funcionarioEntrada.nome.split(" ")[0]}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {o.dataSaida ? (
                      <>
                        <p className="text-carvao-700">{data(o.dataSaida)}</p>
                        <p className="text-xs text-carvao-500">
                          {o.funcionarioSaida?.nome.split(" ")[0] ?? "—"}
                        </p>
                      </>
                    ) : (
                      <span className="text-carvao-400">—</span>
                    )}
                  </Td>
                  <Td className="text-center">
                    <span className="text-xs font-semibold text-carvao-700">
                      {feitos}/{total}
                    </span>
                    <div
                      className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-carvao-200"
                      role="img"
                      aria-label={`${feitos} de ${total} serviços concluídos`}
                    >
                      <div
                        className="h-full bg-marca-500"
                        style={{ width: `${total ? (feitos / total) * 100 : 0}%` }}
                      />
                    </div>
                  </Td>
                  <Td>
                    <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
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
