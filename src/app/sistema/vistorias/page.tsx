import Link from "next/link";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Cartao,
  LinhaVazia,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { dataHora, numeroDoc } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vistorias" };

export default async function VistoriasPage() {
  await exigirModulo("vistorias");

  const vistorias = await prisma.vistoria.findMany({
    include: {
      funcionario: true,
      ordem: { include: { cliente: true, veiculo: true } },
    },
    orderBy: { data: "desc" },
    take: 100,
  });

  return (
    <>
      <TituloPagina
        titulo="Vistorias"
        descricao="Laudos de entrada e saída. Cada vistoria é aberta a partir da sua ordem de serviço."
      />

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th>OS</Th>
              <Th>Cliente / veículo</Th>
              <Th>Vistoriador</Th>
              <Th className="text-center">Avarias</Th>
              <Th className="text-center">Cliente conferiu</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {vistorias.length === 0 && (
              <LinhaVazia
                colunas={8}
                mensagem="Nenhuma vistoria registrada. Abra uma pela tela da ordem de serviço."
              />
            )}
            {vistorias.map((v) => {
              const avarias = Array.isArray(v.avarias) ? v.avarias.length : 0;
              return (
                <tr key={v.id} className="hover:bg-carvao-50">
                  <Td className="whitespace-nowrap text-carvao-600">{dataHora(v.data)}</Td>
                  <Td>
                    <Badge
                      cor={
                        v.tipo === "ENTRADA"
                          ? "bg-blue-600 text-white"
                          : "bg-carvao-950 text-white"
                      }
                    >
                      {v.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/sistema/ordens/${v.ordemId}`}
                      className="font-semibold text-marca-600 hover:underline"
                    >
                      {numeroDoc(v.ordem.numero)}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">{v.ordem.cliente.nome}</p>
                    <p className="text-xs text-carvao-500">
                      {v.ordem.veiculo.marca} {v.ordem.veiculo.modelo} ·{" "}
                      {v.ordem.veiculo.placa}
                    </p>
                  </Td>
                  <Td className="text-carvao-600">{v.funcionario.nome}</Td>
                  <Td className="text-center">
                    {avarias > 0 ? (
                      <Badge cor="bg-marca-600 text-white">{avarias}</Badge>
                    ) : (
                      <span className="text-carvao-400">—</span>
                    )}
                  </Td>
                  <Td className="text-center">
                    {v.aprovadaCliente ? (
                      <Badge cor="bg-emerald-600 text-white">Sim</Badge>
                    ) : (
                      <span className="text-carvao-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/sistema/vistorias/${v.id}`}
                      className="text-sm font-semibold text-marca-600 hover:underline"
                    >
                      Ver laudo
                    </Link>
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
