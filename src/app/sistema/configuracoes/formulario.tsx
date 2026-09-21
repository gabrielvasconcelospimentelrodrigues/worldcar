"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AreaTexto, Aviso, Botao, Campo } from "@/components/ui";
import { salvarEmpresaAction, type Estado } from "./actions";

type DadosEmpresaForm = {
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  instagram: string | null;
  observacoesOrcamento: string | null;
};

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar dados"}
    </Botao>
  );
}

export function FormularioEmpresa({ empresa }: { empresa: DadosEmpresaForm }) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarEmpresaAction, {});

  return (
    <form action={acao} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-6">
        <Campo
          rotulo="Nome da empresa"
          name="nome"
          defaultValue={empresa.nome}
          className="sm:col-span-4"
          required
        />
        <Campo
          rotulo="CNPJ"
          name="cnpj"
          defaultValue={empresa.cnpj ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="Telefone"
          name="telefone"
          defaultValue={empresa.telefone ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="WhatsApp"
          name="whatsapp"
          defaultValue={empresa.whatsapp ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="E-mail"
          name="email"
          type="email"
          defaultValue={empresa.email ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="Endereço"
          name="endereco"
          defaultValue={empresa.endereco ?? ""}
          className="sm:col-span-4"
        />
        <Campo
          rotulo="CEP"
          name="cep"
          defaultValue={empresa.cep ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="Cidade"
          name="cidade"
          defaultValue={empresa.cidade ?? ""}
          className="sm:col-span-3"
        />
        <Campo
          rotulo="UF"
          name="uf"
          maxLength={2}
          defaultValue={empresa.uf ?? ""}
          className="sm:col-span-1"
        />
        <Campo
          rotulo="Instagram"
          name="instagram"
          defaultValue={empresa.instagram ?? ""}
          className="sm:col-span-2"
        />
        <AreaTexto
          rotulo="Observações padrão do orçamento"
          name="observacoesOrcamento"
          rows={3}
          defaultValue={empresa.observacoesOrcamento ?? ""}
          className="sm:col-span-6"
          placeholder="Cláusulas fixas que devem sair em todo orçamento."
        />
      </div>

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="sucesso">{estado.ok}</Aviso>}

      <div className="flex justify-end border-t border-carvao-200 pt-4">
        <Enviar />
      </div>
    </form>
  );
}
