"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  Selecao,
} from "@/components/ui";
import { CATEGORIA_SERVICO, NIVEIS_COMBUSTIVEL } from "@/lib/constantes";
import { brl } from "@/lib/format";
import type { ClienteOpcao, ServicoOpcao } from "../../orcamentos/editor";
import { criarOrdemAction, type Estado } from "../actions";

type Funcionario = { id: string; nome: string; cargo: string };

type Linha = {
  chave: string;
  servicoId: string;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  garantiaDias: number;
};

const novaChave = () => Math.random().toString(36).slice(2, 10);
const linhaVazia = (): Linha => ({
  chave: novaChave(),
  servicoId: "",
  descricao: "",
  quantidade: 1,
  precoUnit: 0,
  garantiaDias: 0,
});

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="px-6 py-2.5">
      {pending ? "Abrindo..." : "Abrir ordem de serviço"}
    </Botao>
  );
}

export function EditorEntrada({
  clientes,
  servicos,
  funcionarios,
}: {
  clientes: ClienteOpcao[];
  servicos: ServicoOpcao[];
  funcionarios: Funcionario[];
}) {
  const [estado, acao] = useActionState<Estado, FormData>(criarOrdemAction, {});
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const veiculos = cliente?.veiculos ?? [];

  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.quantidade * l.precoUnit, 0),
    [linhas],
  );

  const atualizar = (chave: string, m: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...m } : l)));

  const escolherServico = (chave: string, servicoId: string) => {
    const s = servicos.find((x) => x.id === servicoId);
    atualizar(chave, {
      servicoId,
      descricao: s?.nome ?? "",
      precoUnit: s?.preco ?? 0,
      garantiaDias: s?.garantiaDias ?? 0,
    });
  };

  const porCategoria = useMemo(() => {
    const m = new Map<string, ServicoOpcao[]>();
    for (const s of servicos) {
      const l = m.get(s.categoria) ?? [];
      l.push(s);
      m.set(s.categoria, l);
    }
    return [...m.entries()];
  }, [servicos]);

  return (
    <form action={acao} className="space-y-6">
      <input
        type="hidden"
        name="itens"
        value={JSON.stringify(
          linhas
            .filter((l) => l.descricao.trim())
            .map((l) => ({
              servicoId: l.servicoId || null,
              descricao: l.descricao,
              quantidade: l.quantidade,
              precoUnit: l.precoUnit,
              desconto: 0,
              garantiaDias: l.garantiaDias,
            })),
        )}
      />

      <Cartao>
        <CabecalhoCartao
          titulo="Entrada do veículo"
          descricao="Quem recebeu, em que estado e para quando."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Selecao
            rotulo="Cliente"
            name="clienteId"
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setVeiculoId("");
            }}
            required
          >
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.telefone}
              </option>
            ))}
          </Selecao>

          <Selecao
            rotulo="Veículo"
            name="veiculoId"
            value={veiculoId}
            onChange={(e) => setVeiculoId(e.target.value)}
            disabled={!cliente}
            required
          >
            <option value="">
              {cliente ? "Selecione..." : "Escolha o cliente primeiro"}
            </option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} — {v.marca} {v.modelo}
              </option>
            ))}
          </Selecao>

          <Selecao
            rotulo="Funcionário que recebeu"
            name="funcionarioEntradaId"
            dica="Responsável pela entrada"
            required
          >
            <option value="">Selecione...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} — {f.cargo}
              </option>
            ))}
          </Selecao>

          <Campo
            rotulo="KM na entrada"
            name="kmEntrada"
            type="number"
            min={0}
            defaultValue={veiculos.find((v) => v.id === veiculoId)?.km ?? ""}
          />
          <Selecao rotulo="Nível de combustível" name="combustivelEntrada">
            <option value="">Não informado</option>
            {NIVEIS_COMBUSTIVEL.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="Previsão de entrega"
            name="previsaoEntrega"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
          />

          <AreaTexto
            rotulo="Observações da entrada"
            name="observacoesEntrada"
            className="sm:col-span-2 lg:col-span-3"
            rows={2}
            placeholder="Queixa do cliente, avarias relatadas, pertences deixados no veículo..."
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo="Serviços a executar"
          acao={
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar
            </Botao>
          }
        />
        <div className="divide-y divide-carvao-100">
          {linhas.map((l, idx) => (
            <div key={l.chave} className="grid gap-3 p-5 lg:grid-cols-12">
              <Selecao
                rotulo="Serviço"
                value={l.servicoId}
                onChange={(e) => escolherServico(l.chave, e.target.value)}
                className="lg:col-span-4"
              >
                <option value="">— avulso —</option>
                {porCategoria.map(([cat, lista]) => (
                  <optgroup key={cat} label={CATEGORIA_SERVICO[cat as never]}>
                    {lista.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.codigo} · {s.nome} ({brl(s.preco)})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Selecao>
              <Campo
                rotulo="Descrição"
                value={l.descricao}
                onChange={(e) => atualizar(l.chave, { descricao: e.target.value })}
                className="lg:col-span-4"
              />
              <Campo
                rotulo="Qtd"
                type="number"
                step="0.01"
                min={0.01}
                value={l.quantidade}
                onChange={(e) =>
                  atualizar(l.chave, { quantidade: Number(e.target.value) || 0 })
                }
                className="lg:col-span-1"
              />
              <Campo
                rotulo="Preço un."
                type="number"
                step="0.01"
                min={0}
                value={l.precoUnit}
                onChange={(e) =>
                  atualizar(l.chave, { precoUnit: Number(e.target.value) || 0 })
                }
                className="lg:col-span-2"
              />
              <div className="flex items-end lg:col-span-1">
                {linhas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                    className="mb-1 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                    aria-label={`Remover serviço ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-4 border-t border-carvao-200 bg-carvao-50 px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-carvao-600">
            Total da OS
          </span>
          <span className="font-display text-2xl font-extrabold text-carvao-950">
            {brl(total)}
          </span>
        </div>
      </Cartao>

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <div className="flex justify-end">
        <Enviar />
      </div>
    </form>
  );
}
