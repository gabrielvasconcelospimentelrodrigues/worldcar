"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Veiculo } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { AreaTexto, Aviso, Botao, Campo } from "@/components/ui";
import { salvarVeiculoAction, type Estado } from "../actions";

function Enviar({ edicao }: { edicao: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Salvando..." : edicao ? "Salvar veículo" : "Adicionar veículo"}
    </Botao>
  );
}

export function FormularioVeiculo({
  clienteId,
  veiculo,
}: {
  clienteId: string;
  veiculo?: Veiculo;
}) {
  const [aberto, setAberto] = useState(Boolean(veiculo));
  const [estado, acao] = useActionState<Estado, FormData>(salvarVeiculoAction, {});

  if (!aberto) {
    return (
      <div className="p-5">
        <Botao type="button" variante="fantasma" onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar veículo
        </Botao>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-4 border-t border-carvao-200 bg-carvao-50 p-5">
      <input type="hidden" name="clienteId" value={clienteId} />
      {veiculo && <input type="hidden" name="id" value={veiculo.id} />}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
          {veiculo ? "Editar veículo" : "Novo veículo"}
        </h3>
        {!veiculo && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="rounded p-1 text-carvao-500 hover:text-carvao-900"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Campo
          rotulo="Placa"
          id={`placa-${veiculo?.id ?? "novo"}`}
          name="placa"
          defaultValue={veiculo?.placa ?? ""}
          placeholder="ABC1D23"
          maxLength={8}
          className="uppercase"
          required
        />
        <Campo rotulo="Marca" name="marca" defaultValue={veiculo?.marca ?? ""} required />
        <Campo rotulo="Modelo" name="modelo" defaultValue={veiculo?.modelo ?? ""} required />
        <Campo
          rotulo="Ano"
          name="ano"
          type="number"
          min={1900}
          max={2100}
          defaultValue={veiculo?.ano ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Campo rotulo="Cor" name="cor" defaultValue={veiculo?.cor ?? ""} />
        <Campo
          rotulo="KM atual"
          name="km"
          type="number"
          min={0}
          defaultValue={veiculo?.km ?? ""}
        />
        <Campo rotulo="Chassi" name="chassi" defaultValue={veiculo?.chassi ?? ""} />
        <Campo rotulo="Renavam" name="renavam" defaultValue={veiculo?.renavam ?? ""} />
      </div>

      <AreaTexto
        rotulo="Observações do veículo"
        name="observacoes"
        rows={2}
        defaultValue={veiculo?.observacoes ?? ""}
        placeholder="Avarias pré-existentes, particularidades..."
      />

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="sucesso">{estado.ok}</Aviso>}

      <div className="flex justify-end gap-2">
        <Enviar edicao={Boolean(veiculo)} />
      </div>
    </form>
  );
}
