import { exigirModulo } from "@/lib/auth";
import { Cartao, TituloPagina } from "@/components/ui";
import { FormularioCliente } from "../formulario-cliente";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await exigirModulo("clientes");
  return (
    <>
      <TituloPagina
        titulo="Novo cliente"
        descricao="Depois de salvar você poderá cadastrar os veículos."
      />
      <Cartao className="max-w-4xl">
        <FormularioCliente />
      </Cartao>
    </>
  );
}
