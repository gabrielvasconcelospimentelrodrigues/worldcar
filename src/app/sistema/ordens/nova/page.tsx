import Link from "next/link";
import { exigirModulo } from "@/lib/auth";
import { Aviso, TituloPagina } from "@/components/ui";
import { funcionariosAtivos, opcoesDoEditor } from "../../orcamentos/consultas";
import { EditorEntrada } from "./editor-entrada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrada de veículo" };

export default async function NovaOrdemPage() {
  await exigirModulo("ordens");
  const [{ clientes, servicos }, funcionarios] = await Promise.all([
    opcoesDoEditor(),
    funcionariosAtivos(),
  ]);

  return (
    <>
      <TituloPagina
        titulo="Entrada de veículo"
        descricao="Abre a OS direto, sem orçamento prévio. Para converter um orçamento aprovado, use a tela do orçamento."
      />

      {funcionarios.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Nenhum funcionário ativo cadastrado. Toda OS precisa de um responsável pela
            entrada —{" "}
            <Link href="/sistema/rh" className="font-semibold underline">
              cadastre a equipe no RH
            </Link>
            .
          </Aviso>
        </div>
      )}

      <EditorEntrada
        clientes={clientes}
        servicos={servicos}
        funcionarios={funcionarios}
      />
    </>
  );
}
