"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Cliente } from "@prisma/client";
import { AreaTexto, Aviso, Botao, Campo, Selecao } from "@/components/ui";
import { salvarClienteAction, type Estado } from "./actions";

function Enviar({ novo }: { novo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Salvando..." : novo ? "Cadastrar cliente" : "Salvar alterações"}
    </Botao>
  );
}

export function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarClienteAction, {});

  return (
    <form action={acao} className="space-y-5 p-5">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Selecao rotulo="Tipo" id="tipo" name="tipo" defaultValue={cliente?.tipo ?? "FISICA"}>
          <option value="FISICA">Pessoa física</option>
          <option value="JURIDICA">Pessoa jurídica</option>
        </Selecao>
        <Campo
          rotulo="Nome / Razão social"
          id="nome"
          name="nome"
          defaultValue={cliente?.nome}
          className="sm:col-span-2"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          rotulo="CPF / CNPJ"
          id="documento"
          name="documento"
          defaultValue={cliente?.documento ?? ""}
          placeholder="Somente números"
        />
        <Campo
          rotulo="Telefone / WhatsApp"
          id="telefone"
          name="telefone"
          defaultValue={cliente?.telefone}
          placeholder="(41) 90000-0000"
          required
        />
        <Campo
          rotulo="Telefone secundário"
          id="telefone2"
          name="telefone2"
          defaultValue={cliente?.telefone2 ?? ""}
        />
      </div>

      <Campo
        rotulo="E-mail"
        id="email"
        name="email"
        type="email"
        defaultValue={cliente?.email ?? ""}
      />

      <fieldset className="grid gap-4 border-t border-carvao-200 pt-5 sm:grid-cols-6">
        <legend className="sr-only">Endereço</legend>
        <Campo rotulo="CEP" id="cep" name="cep" defaultValue={cliente?.cep ?? ""} className="sm:col-span-2" />
        <Campo
          rotulo="Endereço"
          id="endereco"
          name="endereco"
          defaultValue={cliente?.endereco ?? ""}
          className="sm:col-span-3"
        />
        <Campo rotulo="Nº" id="numero" name="numero" defaultValue={cliente?.numero ?? ""} />
        <Campo
          rotulo="Bairro"
          id="bairro"
          name="bairro"
          defaultValue={cliente?.bairro ?? ""}
          className="sm:col-span-2"
        />
        <Campo
          rotulo="Cidade"
          id="cidade"
          name="cidade"
          defaultValue={cliente?.cidade ?? "Curitiba"}
          className="sm:col-span-3"
        />
        <Campo rotulo="UF" id="uf" name="uf" maxLength={2} defaultValue={cliente?.uf ?? "PR"} />
      </fieldset>

      <AreaTexto
        rotulo="Observações"
        id="observacoes"
        name="observacoes"
        defaultValue={cliente?.observacoes ?? ""}
        placeholder="Preferências, histórico, restrições..."
      />

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <div className="flex justify-end border-t border-carvao-200 pt-5">
        <Enviar novo={!cliente} />
      </div>
    </form>
  );
}
