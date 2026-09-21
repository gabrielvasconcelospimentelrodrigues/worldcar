import { notFound, redirect } from "next/navigation";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TituloPagina } from "@/components/ui";
import { num, numeroDoc } from "@/lib/format";
import { opcoesDoEditor } from "../../consultas";
import { EditorOrcamento } from "../../editor";

export const dynamic = "force-dynamic";

export default async function EditarOrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModulo("orcamentos");
  const { id } = await params;

  const orc = await prisma.orcamento.findUnique({
    where: { id },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });
  if (!orc) notFound();
  // Depois de virar OS o documento e historico: edicao so pela OS.
  if (orc.status === "CONVERTIDO") redirect(`/sistema/orcamentos/${id}`);

  const { clientes, servicos } = await opcoesDoEditor();

  return (
    <>
      <TituloPagina
        titulo={`Editar orçamento ${numeroDoc(orc.numero)}`}
        descricao="Salvar substitui os itens e recalcula os totais."
      />
      <EditorOrcamento
        clientes={clientes}
        servicos={servicos}
        orcamento={{
          id: orc.id,
          clienteId: orc.clienteId,
          veiculoId: orc.veiculoId,
          validadeDias: orc.validadeDias,
          kmVeiculo: orc.kmVeiculo,
          descontoTipo: orc.descontoTipo,
          desconto: num(orc.desconto),
          prazoEntregaDias: orc.prazoEntregaDias,
          formaPagamento: orc.formaPagamento,
          observacoes: orc.observacoes,
          itens: orc.itens.map((i) => ({
            servicoId: i.servicoId,
            descricao: i.descricao,
            quantidade: num(i.quantidade),
            precoUnit: num(i.precoUnit),
            desconto: num(i.desconto),
          })),
        }}
      />
    </>
  );
}
