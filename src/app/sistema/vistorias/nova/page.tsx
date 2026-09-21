import { notFound, redirect } from "next/navigation";
import type { TipoVistoria } from "@prisma/client";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TituloPagina } from "@/components/ui";
import { numeroDoc } from "@/lib/format";
import type { EstadoItemVistoria } from "@/lib/constantes";
import { funcionariosAtivos } from "../../orcamentos/consultas";
import { FormularioVistoria } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova vistoria" };

export default async function NovaVistoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string; tipo?: string }>;
}) {
  await exigirModulo("vistorias");
  const { ordem: ordemId, tipo: tipoBruto } = await searchParams;

  if (!ordemId) redirect("/sistema/vistorias");
  const tipo: TipoVistoria = tipoBruto === "SAIDA" ? "SAIDA" : "ENTRADA";

  const [ordem, funcionarios] = await Promise.all([
    prisma.ordemServico.findUnique({
      where: { id: ordemId },
      include: { cliente: true, veiculo: true, vistorias: true },
    }),
    funcionariosAtivos(),
  ]);

  if (!ordem) notFound();

  const existente = ordem.vistorias.find((v) => v.tipo === tipo);

  return (
    <>
      <TituloPagina
        titulo={`Vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
        descricao={
          existente
            ? "Já existe uma vistoria deste tipo nesta OS — salvar substitui a anterior."
            : `OS ${numeroDoc(ordem.numero)} · registre o estado do veículo item por item.`
        }
      />

      <FormularioVistoria
        tipo={tipo}
        funcionarios={funcionarios}
        ordem={{
          id: ordem.id,
          numero: ordem.numero,
          cliente: ordem.cliente.nome,
          veiculo: `${ordem.veiculo.marca} ${ordem.veiculo.modelo}`,
          placa: ordem.veiculo.placa,
          km: tipo === "ENTRADA" ? ordem.kmEntrada : (ordem.kmSaida ?? ordem.kmEntrada),
        }}
        vistoriaExistente={
          existente
            ? {
                funcionarioId: existente.funcionarioId,
                km: existente.km,
                combustivel: existente.combustivel,
                checklist: (existente.checklist ?? {}) as Record<
                  string,
                  EstadoItemVistoria
                >,
                avarias: (existente.avarias ?? []) as {
                  local: string;
                  descricao: string;
                  gravidade: string;
                }[],
                pertences: existente.pertences,
                observacoes: existente.observacoes,
                aprovadaCliente: existente.aprovadaCliente,
                assinaturaCliente: existente.assinaturaCliente,
              }
            : undefined
        }
      />
    </>
  );
}
