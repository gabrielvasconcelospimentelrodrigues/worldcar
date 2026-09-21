import Link from "next/link";
import { exigirModulo } from "@/lib/auth";
import { Aviso, TituloPagina } from "@/components/ui";
import { opcoesDoEditor } from "../consultas";
import { EditorOrcamento } from "../editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo orçamento" };

export default async function NovoOrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  await exigirModulo("orcamentos");
  const { cliente } = await searchParams;
  const { clientes, servicos } = await opcoesDoEditor();

  return (
    <>
      <TituloPagina
        titulo="Novo orçamento"
        descricao="Monte a proposta; o PDF com as três vias é gerado depois de salvar."
      />

      {clientes.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Nenhum cliente cadastrado.{" "}
            <Link href="/sistema/clientes/novo" className="font-semibold underline">
              Cadastre o primeiro cliente
            </Link>{" "}
            antes de abrir um orçamento.
          </Aviso>
        </div>
      )}

      <EditorOrcamento
        clientes={clientes}
        servicos={servicos}
        clienteInicial={cliente}
      />
    </>
  );
}
