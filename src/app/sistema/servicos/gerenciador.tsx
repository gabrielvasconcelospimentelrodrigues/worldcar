"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Servico } from "@prisma/client";
import { Pencil, Plus, X } from "lucide-react";
import {
  AreaTexto,
  Aviso,
  Badge,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  LinhaVazia,
  Selecao,
  Tabela,
  Td,
  Th,
} from "@/components/ui";
import { CATEGORIA_SERVICO } from "@/lib/constantes";
import { brl } from "@/lib/format";
import {
  alternarAtivoServicoAction,
  salvarServicoAction,
  type Estado,
} from "./actions";

function Enviar({ edicao }: { edicao: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Salvando..." : edicao ? "Salvar alterações" : "Cadastrar serviço"}
    </Botao>
  );
}

type ServicoSerializado = Omit<Servico, "preco" | "custo" | "comissaoPct"> & {
  preco: number;
  custo: number;
  comissaoPct: number;
};

export function GerenciadorServicos({ servicos }: { servicos: ServicoSerializado[] }) {
  const [editando, setEditando] = useState<ServicoSerializado | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [estado, acao] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await salvarServicoAction(prev, dados);
      if (r.ok) {
        setEditando(null);
        setFormAberto(false);
      }
      return r;
    },
    {},
  );

  const abrirNovo = () => {
    setEditando(null);
    setFormAberto(true);
  };

  const abrirEdicao = (s: ServicoSerializado) => {
    setEditando(s);
    setFormAberto(true);
  };

  return (
    <div className="space-y-6">
      {formAberto && (
        <Cartao>
          <CabecalhoCartao
            titulo={editando ? `Editar: ${editando.nome}` : "Novo serviço"}
            acao={
              <button
                type="button"
                onClick={() => {
                  setFormAberto(false);
                  setEditando(null);
                }}
                className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                aria-label="Fechar formulário"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          {/* key força o React a recriar os campos ao trocar de serviço editado */}
          <form key={editando?.id ?? "novo"} action={acao} className="space-y-4 p-5">
            {editando && <input type="hidden" name="id" value={editando.id} />}

            <div className="grid gap-4 sm:grid-cols-6">
              <Campo
                rotulo="Código"
                name="codigo"
                defaultValue={editando?.codigo ?? ""}
                placeholder="EST-01"
                className="sm:col-span-1"
                required
              />
              <Campo
                rotulo="Nome do serviço"
                name="nome"
                defaultValue={editando?.nome ?? ""}
                className="sm:col-span-3"
                required
              />
              <Selecao
                rotulo="Categoria"
                name="categoria"
                defaultValue={editando?.categoria ?? "ESTETICA"}
                className="sm:col-span-2"
              >
                {Object.entries(CATEGORIA_SERVICO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selecao>
            </div>

            <AreaTexto
              rotulo="Descrição"
              name="descricao"
              rows={2}
              defaultValue={editando?.descricao ?? ""}
              placeholder="O que está incluso neste serviço (aparece no PDF do orçamento)."
            />

            <div className="grid gap-4 sm:grid-cols-5">
              <Campo
                rotulo="Preço (R$)"
                name="preco"
                type="number"
                step="0.01"
                min={0}
                defaultValue={editando?.preco ?? ""}
                required
              />
              <Campo
                rotulo="Custo (R$)"
                name="custo"
                type="number"
                step="0.01"
                min={0}
                defaultValue={editando?.custo ?? 0}
                dica="Material/insumo"
              />
              <Campo
                rotulo="Duração (min)"
                name="duracaoMin"
                type="number"
                min={0}
                defaultValue={editando?.duracaoMin ?? 60}
              />
              <Campo
                rotulo="Garantia (dias)"
                name="garantiaDias"
                type="number"
                min={0}
                defaultValue={editando?.garantiaDias ?? 0}
                dica="Gera alerta de retorno"
              />
              <Campo
                rotulo="Comissão (%)"
                name="comissaoPct"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={editando?.comissaoPct ?? 0}
              />
            </div>

            {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

            <div className="flex justify-end border-t border-carvao-200 pt-4">
              <Enviar edicao={Boolean(editando)} />
            </div>
          </form>
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao
          titulo="Catálogo"
          descricao={`${servicos.length} serviço(s)`}
          acao={
            !formAberto && (
              <Botao type="button" onClick={abrirNovo}>
                <Plus className="h-4 w-4" aria-hidden />
                Novo serviço
              </Botao>
            )
          }
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Serviço</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Preço</Th>
              <Th className="text-center">Duração</Th>
              <Th className="text-center">Garantia</Th>
              <Th className="text-center">Comissão</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {servicos.length === 0 && (
              <LinhaVazia colunas={8} mensagem="Nenhum serviço cadastrado." />
            )}
            {servicos.map((s) => (
              <tr key={s.id} className={s.ativo ? "hover:bg-carvao-50" : "opacity-50"}>
                <Td className="font-mono text-xs font-semibold">{s.codigo}</Td>
                <Td>
                  <p className="font-medium text-carvao-950">{s.nome}</p>
                  {s.descricao && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-carvao-500">
                      {s.descricao}
                    </p>
                  )}
                </Td>
                <Td>
                  <Badge cor="bg-carvao-100 text-carvao-700">
                    {CATEGORIA_SERVICO[s.categoria]}
                  </Badge>
                </Td>
                <Td className="text-right font-semibold">{brl(s.preco)}</Td>
                <Td className="text-center text-carvao-600">{s.duracaoMin} min</Td>
                <Td className="text-center text-carvao-600">
                  {s.garantiaDias > 0 ? `${s.garantiaDias}d` : "—"}
                </Td>
                <Td className="text-center text-carvao-600">
                  {s.comissaoPct > 0 ? `${s.comissaoPct}%` : "—"}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(s)}
                      className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                      aria-label={`Editar ${s.nome}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <form action={alternarAtivoServicoAction.bind(null, s.id)}>
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100 hover:text-carvao-900"
                      >
                        {s.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
    </div>
  );
}
