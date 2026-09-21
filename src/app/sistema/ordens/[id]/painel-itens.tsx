"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { StatusItemOS } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
import {
  Aviso,
  Badge,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  Selecao,
} from "@/components/ui";
import { CATEGORIA_SERVICO, STATUS_ITEM_OS } from "@/lib/constantes";
import { brl, dataHora } from "@/lib/format";
import type { ServicoOpcao } from "../../orcamentos/editor";
import {
  adicionarItemAction,
  atualizarItemAction,
  removerItemAction,
  type Estado,
} from "../actions";

export type ItemOS = {
  id: string;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  total: number;
  status: StatusItemOS;
  responsavelId: string | null;
  iniciadoEm: Date | null;
  concluidoEm: Date | null;
  garantiaDias: number;
};

type Funcionario = { id: string; nome: string; cargo: string };

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="fantasma" disabled={pending} className="px-3 py-1.5 text-xs">
      {pending ? "..." : "Salvar"}
    </Botao>
  );
}

function BotaoAdicionar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Adicionando..." : "Adicionar à OS"}
    </Botao>
  );
}

export function PainelItens({
  ordemId,
  itens,
  funcionarios,
  servicos,
  editavel,
}: {
  ordemId: string;
  itens: ItemOS[];
  funcionarios: Funcionario[];
  servicos: ServicoOpcao[];
  editavel: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [estado, acaoAdicionar] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await adicionarItemAction(prev, dados);
      if (r.ok) setAdicionando(false);
      return r;
    },
    {},
  );
  const [servicoEscolhido, setServicoEscolhido] = useState<ServicoOpcao | null>(null);

  const concluidos = itens.filter((i) => i.status === "CONCLUIDO").length;

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Serviços da OS"
        descricao={`${concluidos} de ${itens.length} concluído(s)`}
        acao={
          editavel &&
          !adicionando && (
            <Botao type="button" variante="fantasma" onClick={() => setAdicionando(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar serviço
            </Botao>
          )
        }
      />

      {adicionando && (
        <form action={acaoAdicionar} className="space-y-4 border-b border-carvao-200 bg-carvao-50 p-5">
          <input type="hidden" name="ordemId" value={ordemId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <Selecao
              rotulo="Serviço"
              name="servicoId"
              onChange={(e) =>
                setServicoEscolhido(servicos.find((s) => s.id === e.target.value) ?? null)
              }
              className="sm:col-span-2"
            >
              <option value="">— avulso —</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {CATEGORIA_SERVICO[s.categoria]} · {s.nome} ({brl(s.preco)})
                </option>
              ))}
            </Selecao>
            <Campo
              rotulo="Descrição"
              name="descricao"
              key={servicoEscolhido?.id ?? "vazio"}
              defaultValue={servicoEscolhido?.nome ?? ""}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Qtd" name="quantidade" type="number" step="0.01" min={0.01} defaultValue={1} />
              <Campo
                rotulo="Preço un."
                name="precoUnit"
                type="number"
                step="0.01"
                min={0}
                key={`preco-${servicoEscolhido?.id ?? "vazio"}`}
                defaultValue={servicoEscolhido?.preco ?? 0}
              />
            </div>
          </div>
          {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <div className="flex gap-2">
            <BotaoAdicionar />
            <Botao type="button" variante="fantasma" onClick={() => setAdicionando(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}

      <ul className="divide-y divide-carvao-100">
        {itens.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-carvao-500">
            Nenhum serviço nesta OS.
          </li>
        )}
        {itens.map((i) => (
          <li key={i.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-carvao-950">{i.descricao}</p>
                <p className="mt-0.5 text-xs text-carvao-500">
                  {i.quantidade} × {brl(i.precoUnit)} ={" "}
                  <strong className="text-carvao-800">{brl(i.total)}</strong>
                  {i.garantiaDias > 0 && ` · garantia de ${i.garantiaDias} dias`}
                </p>
                {(i.iniciadoEm || i.concluidoEm) && (
                  <p className="mt-1 text-xs text-carvao-500">
                    {i.iniciadoEm && `Iniciado ${dataHora(i.iniciadoEm)}`}
                    {i.iniciadoEm && i.concluidoEm && " · "}
                    {i.concluidoEm && `Concluído ${dataHora(i.concluidoEm)}`}
                  </p>
                )}
              </div>
              <Badge cor={STATUS_ITEM_OS[i.status].cor}>
                {STATUS_ITEM_OS[i.status].label}
              </Badge>
            </div>

            {editavel && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form action={atualizarItemAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="ordemId" value={ordemId} />
                  <Selecao
                    rotulo="Responsável"
                    name="responsavelId"
                    defaultValue={i.responsavelId ?? ""}
                    className="w-52"
                  >
                    <option value="">Não atribuído</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </Selecao>
                  <Selecao
                    rotulo="Situação"
                    name="status"
                    defaultValue={i.status}
                    className="w-40"
                  >
                    {Object.entries(STATUS_ITEM_OS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </Selecao>
                  <div className="pb-0.5">
                    <BotaoSalvar />
                  </div>
                </form>

                <form action={removerItemAction} className="pb-0.5">
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="ordemId" value={ordemId} />
                  <button
                    type="submit"
                    className="rounded p-2 text-carvao-400 transition hover:bg-marca-50 hover:text-marca-600"
                    aria-label={`Remover ${i.descricao}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
