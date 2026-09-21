"use client";

import { useState } from "react";
import type { StatusOrcamento } from "@prisma/client";
import { Check, Send, Undo2, X } from "lucide-react";
import { AreaTexto, Botao, Campo, Selecao } from "@/components/ui";
import { NIVEIS_COMBUSTIVEL } from "@/lib/constantes";
import { converterEmOrdemAction, mudarStatusOrcamentoAction } from "../actions";

type Funcionario = { id: string; nome: string; cargo: string };

export function AcoesOrcamento({
  id,
  status,
  funcionarios,
}: {
  id: string;
  status: StatusOrcamento;
  funcionarios: Funcionario[];
}) {
  const [recusando, setRecusando] = useState(false);
  const [convertendo, setConvertendo] = useState(false);

  if (status === "CONVERTIDO") return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(status === "RASCUNHO" || status === "EXPIRADO") && (
          <form action={mudarStatusOrcamentoAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="ENVIADO" />
            <Botao type="submit" variante="secundario">
              <Send className="h-4 w-4" aria-hidden />
              Marcar como enviado
            </Botao>
          </form>
        )}

        {status !== "APROVADO" && status !== "RECUSADO" && (
          <form action={mudarStatusOrcamentoAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="APROVADO" />
            <Botao type="submit">
              <Check className="h-4 w-4" aria-hidden />
              Cliente aprovou
            </Botao>
          </form>
        )}

        {status !== "RECUSADO" && (
          <Botao type="button" variante="perigo" onClick={() => setRecusando((v) => !v)}>
            <X className="h-4 w-4" aria-hidden />
            Cliente recusou
          </Botao>
        )}

        {(status === "APROVADO" || status === "RECUSADO") && (
          <form action={mudarStatusOrcamentoAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="ENVIADO" />
            <Botao type="submit" variante="fantasma">
              <Undo2 className="h-4 w-4" aria-hidden />
              Reabrir
            </Botao>
          </form>
        )}

        {status === "APROVADO" && (
          <Botao type="button" variante="secundario" onClick={() => setConvertendo((v) => !v)}>
            Gerar ordem de serviço
          </Botao>
        )}
      </div>

      {recusando && (
        <form
          action={mudarStatusOrcamentoAction}
          className="space-y-3 rounded-md border border-marca-200 bg-marca-50 p-4"
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="RECUSADO" />
          <AreaTexto
            rotulo="Motivo da recusa"
            name="motivo"
            rows={2}
            placeholder="Preço, prazo, foi em outro lugar..."
          />
          <div className="flex gap-2">
            <Botao type="submit" variante="perigo">
              Confirmar recusa
            </Botao>
            <Botao type="button" variante="fantasma" onClick={() => setRecusando(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}

      {convertendo && (
        <form
          action={converterEmOrdemAction}
          className="space-y-4 rounded-md border border-carvao-300 bg-carvao-50 p-4"
        >
          <input type="hidden" name="id" value={id} />
          <div>
            <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
              Entrada do veículo
            </h3>
            <p className="mt-0.5 text-sm text-carvao-600">
              Registre quem está recebendo o veículo. A OS nasce com estes dados.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Funcionário que recebeu" name="funcionarioEntradaId" required>
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.cargo}
                </option>
              ))}
            </Selecao>
            <Campo
              rotulo="Previsão de entrega"
              name="previsaoEntrega"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
            />
            <Campo rotulo="KM na entrada" name="kmEntrada" type="number" min={0} />
            <Selecao rotulo="Nível de combustível" name="combustivelEntrada">
              <option value="">Não informado</option>
              {NIVEIS_COMBUSTIVEL.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Selecao>
          </div>

          <div className="flex gap-2">
            <Botao type="submit">Abrir ordem de serviço</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setConvertendo(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
