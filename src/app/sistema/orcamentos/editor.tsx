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
import { brl } from "@/lib/format";
import { CATEGORIA_SERVICO } from "@/lib/constantes";
import { salvarOrcamentoAction, type Estado } from "./actions";

export type ClienteOpcao = {
  id: string;
  nome: string;
  telefone: string;
  veiculos: { id: string; placa: string; marca: string; modelo: string; km: number | null }[];
};

export type ServicoOpcao = {
  id: string;
  codigo: string;
  nome: string;
  categoria: keyof typeof CATEGORIA_SERVICO;
  preco: number;
  garantiaDias: number;
  descricao: string | null;
};

type Linha = {
  chave: string;
  servicoId: string;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  desconto: number;
  garantiaDias: number;
};

export type OrcamentoEdicao = {
  id: string;
  clienteId: string;
  veiculoId: string;
  validadeDias: number;
  kmVeiculo: number | null;
  descontoTipo: string;
  desconto: number;
  prazoEntregaDias: number | null;
  formaPagamento: string | null;
  observacoes: string | null;
  itens: {
    servicoId: string | null;
    descricao: string;
    quantidade: number;
    precoUnit: number;
    desconto: number;
  }[];
};

const novaChave = () => Math.random().toString(36).slice(2, 10);

function linhaVazia(): Linha {
  return {
    chave: novaChave(),
    servicoId: "",
    descricao: "",
    quantidade: 1,
    precoUnit: 0,
    desconto: 0,
    garantiaDias: 0,
  };
}

function Enviar({ edicao }: { edicao: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="px-6 py-2.5">
      {pending ? "Salvando..." : edicao ? "Salvar orçamento" : "Gerar orçamento"}
    </Botao>
  );
}

export function EditorOrcamento({
  clientes,
  servicos,
  orcamento,
  clienteInicial,
}: {
  clientes: ClienteOpcao[];
  servicos: ServicoOpcao[];
  orcamento?: OrcamentoEdicao;
  clienteInicial?: string;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarOrcamentoAction, {});

  const [clienteId, setClienteId] = useState(
    orcamento?.clienteId ?? clienteInicial ?? "",
  );
  const [veiculoId, setVeiculoId] = useState(orcamento?.veiculoId ?? "");
  const [descontoTipo, setDescontoTipo] = useState(
    orcamento?.descontoTipo === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
  );
  const [desconto, setDesconto] = useState(orcamento?.desconto ?? 0);

  const [linhas, setLinhas] = useState<Linha[]>(() =>
    orcamento?.itens.length
      ? orcamento.itens.map((i) => ({
          chave: novaChave(),
          servicoId: i.servicoId ?? "",
          descricao: i.descricao,
          quantidade: i.quantidade,
          precoUnit: i.precoUnit,
          desconto: i.desconto,
          garantiaDias:
            servicos.find((s) => s.id === i.servicoId)?.garantiaDias ?? 0,
        }))
      : [linhaVazia()],
  );

  const cliente = clientes.find((c) => c.id === clienteId);
  const veiculos = cliente?.veiculos ?? [];

  const totais = useMemo(() => {
    const subtotal = linhas.reduce(
      (s, l) => s + Math.max(0, l.quantidade * l.precoUnit - l.desconto),
      0,
    );
    const abatimento =
      descontoTipo === "PERCENTUAL"
        ? (subtotal * Math.min(Math.max(desconto, 0), 100)) / 100
        : Math.max(desconto, 0);
    return { subtotal, abatimento, total: Math.max(0, subtotal - abatimento) };
  }, [linhas, descontoTipo, desconto]);

  const atualizar = (chave: string, mudanca: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));

  const escolherServico = (chave: string, servicoId: string) => {
    const s = servicos.find((x) => x.id === servicoId);
    atualizar(chave, {
      servicoId,
      descricao: s ? s.nome : "",
      precoUnit: s ? s.preco : 0,
      garantiaDias: s?.garantiaDias ?? 0,
    });
  };

  const porCategoria = useMemo(() => {
    const m = new Map<string, ServicoOpcao[]>();
    for (const s of servicos) {
      const lista = m.get(s.categoria) ?? [];
      lista.push(s);
      m.set(s.categoria, lista);
    }
    return [...m.entries()];
  }, [servicos]);

  return (
    <form action={acao} className="space-y-6">
      {orcamento && <input type="hidden" name="id" value={orcamento.id} />}
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
              desconto: l.desconto,
              garantiaDias: l.garantiaDias,
            })),
        )}
      />

      {/* ---------- Cliente e veiculo ---------- */}
      <Cartao>
        <CabecalhoCartao titulo="Cliente e veículo" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
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
            <option value="">Selecione o cliente...</option>
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
            dica={
              cliente && veiculos.length === 0
                ? "Este cliente não tem veículos. Cadastre um na ficha dele."
                : undefined
            }
            required
          >
            <option value="">
              {cliente ? "Selecione o veículo..." : "Escolha o cliente primeiro"}
            </option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} — {v.marca} {v.modelo}
              </option>
            ))}
          </Selecao>

          <Campo
            rotulo="KM do veículo"
            name="kmVeiculo"
            type="number"
            min={0}
            defaultValue={
              orcamento?.kmVeiculo ??
              veiculos.find((v) => v.id === veiculoId)?.km ??
              ""
            }
          />
          <Campo
            rotulo="Validade do orçamento (dias)"
            name="validadeDias"
            type="number"
            min={1}
            max={365}
            defaultValue={orcamento?.validadeDias ?? 10}
            required
          />
        </div>
      </Cartao>

      {/* ---------- Itens ---------- */}
      <Cartao>
        <CabecalhoCartao
          titulo="Serviços orçados"
          descricao="Escolha do catálogo ou descreva um item avulso."
          acao={
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar item
            </Botao>
          }
        />

        <div className="divide-y divide-carvao-100">
          {linhas.map((l, idx) => {
            const totalLinha = Math.max(
              0,
              l.quantidade * l.precoUnit - l.desconto,
            );
            return (
              <div key={l.chave} className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-carvao-500">
                    Item {idx + 1}
                    {l.garantiaDias > 0 && (
                      <span className="ml-2 font-medium normal-case text-marca-600">
                        garantia de {l.garantiaDias} dias
                      </span>
                    )}
                  </span>
                  {linhas.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))
                      }
                      className="rounded p-1.5 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                      aria-label={`Remover item ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-12">
                  <Selecao
                    rotulo="Serviço do catálogo"
                    value={l.servicoId}
                    onChange={(e) => escolherServico(l.chave, e.target.value)}
                    className="lg:col-span-4"
                  >
                    <option value="">— item avulso —</option>
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
                    placeholder="Descrição que aparece no PDF"
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
                    className="lg:col-span-1"
                  />
                  <Campo
                    rotulo="Desc. R$"
                    type="number"
                    step="0.01"
                    min={0}
                    value={l.desconto}
                    onChange={(e) =>
                      atualizar(l.chave, { desconto: Number(e.target.value) || 0 })
                    }
                    className="lg:col-span-1"
                  />

                  <div className="lg:col-span-1">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                      Total
                    </span>
                    <p className="py-2 text-sm font-bold text-carvao-950">
                      {brl(totalLinha)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div className="border-t border-carvao-200 bg-carvao-50 p-5">
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <Selecao
              rotulo="Tipo de desconto"
              name="descontoTipo"
              value={descontoTipo}
              onChange={(e) => setDescontoTipo(e.target.value)}
            >
              <option value="VALOR">Valor (R$)</option>
              <option value="PERCENTUAL">Percentual (%)</option>
            </Selecao>
            <Campo
              rotulo={`Desconto geral (${descontoTipo === "PERCENTUAL" ? "%" : "R$"})`}
              name="desconto"
              type="number"
              step="0.01"
              min={0}
              value={desconto}
              onChange={(e) => setDesconto(Number(e.target.value) || 0)}
            />
            <dl className="space-y-1 text-sm sm:text-right">
              <div className="flex justify-between gap-6 sm:justify-end">
                <dt className="text-carvao-600">Subtotal</dt>
                <dd className="font-medium">{brl(totais.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6 sm:justify-end">
                <dt className="text-carvao-600">Desconto</dt>
                <dd className="font-medium text-marca-600">
                  − {brl(totais.abatimento)}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-carvao-300 pt-1 sm:justify-end">
                <dt className="font-bold text-carvao-950">Total</dt>
                <dd className="font-display text-2xl font-extrabold text-carvao-950">
                  {brl(totais.total)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Cartao>

      {/* ---------- Condicoes ---------- */}
      <Cartao>
        <CabecalhoCartao titulo="Condições" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Campo
            rotulo="Prazo de entrega (dias úteis)"
            name="prazoEntregaDias"
            type="number"
            min={0}
            defaultValue={orcamento?.prazoEntregaDias ?? ""}
          />
          <Campo
            rotulo="Forma de pagamento"
            name="formaPagamento"
            defaultValue={orcamento?.formaPagamento ?? ""}
            placeholder="PIX, cartão em até 3x, 50% entrada..."
          />
          <AreaTexto
            rotulo="Observações (saem no PDF)"
            name="observacoes"
            className="sm:col-span-2"
            defaultValue={orcamento?.observacoes ?? ""}
            placeholder="Condições especiais, peças não inclusas, ressalvas..."
          />
        </div>
      </Cartao>

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <div className="flex justify-end gap-3">
        <Enviar edicao={Boolean(orcamento)} />
      </div>
    </form>
  );
}
