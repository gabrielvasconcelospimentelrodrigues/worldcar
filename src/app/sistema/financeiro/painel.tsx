"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormaPagamento, StatusLancamento, TipoLancamento } from "@prisma/client";
import { Check, Plus, Trash2, Undo2 } from "lucide-react";
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
import { FORMA_PAGAMENTO, STATUS_LANCAMENTO } from "@/lib/constantes";
import { brl, data, numeroDoc } from "@/lib/format";
import {
  baixarLancamentoAction,
  excluirLancamentoAction,
  salvarLancamentoAction,
  type Estado,
} from "./actions";

export type LancamentoItem = {
  id: string;
  tipo: TipoLancamento;
  status: StatusLancamento;
  descricao: string;
  valor: number;
  vencimento: Date;
  pagamento: Date | null;
  forma: FormaPagamento | null;
  fornecedor: string | null;
  categoria: { nome: string } | null;
  ordem: { id: string; numero: number } | null;
};

export function PainelFinanceiro({
  lancamentos,
  categorias,
}: {
  lancamentos: LancamentoItem[];
  categorias: { id: string; nome: string; tipo: TipoLancamento }[];
}) {
  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamento>("DESPESA");
  const [estado, acao] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await salvarLancamentoAction(prev, dados);
      if (r.ok) setCriando(false);
      return r;
    },
    {},
  );

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  return (
    <div className="space-y-6">
      <Cartao>
        <CabecalhoCartao
          titulo="Novo lançamento"
          descricao="Receitas avulsas e despesas da oficina. As receitas de OS entram sozinhas na entrega."
          acao={
            <Botao
              type="button"
              variante={criando ? "fantasma" : "primario"}
              onClick={() => setCriando((v) => !v)}
            >
              {criando ? (
                "Fechar"
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden />
                  Lançar
                </>
              )}
            </Botao>
          }
        />
        {criando && (
          <form action={acao} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Selecao
                rotulo="Tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoLancamento)}
              >
                <option value="DESPESA">Despesa</option>
                <option value="RECEITA">Receita</option>
              </Selecao>
              <Campo
                rotulo="Descrição"
                name="descricao"
                className="sm:col-span-3"
                placeholder={
                  tipo === "DESPESA"
                    ? "Compra de materiais, aluguel, energia..."
                    : "Venda de produto, serviço avulso..."
                }
                required
              />
              <Campo
                rotulo="Valor total (R$)"
                name="valor"
                type="number"
                step="0.01"
                min={0.01}
                required
              />
              <Campo
                rotulo="Vencimento"
                name="vencimento"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
              <Campo
                rotulo="Parcelas"
                name="parcelas"
                type="number"
                min={1}
                max={36}
                defaultValue={1}
                dica="A cada 30 dias"
              />
              <Selecao rotulo="Categoria" name="categoriaId">
                <option value="">Sem categoria</option>
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
              <Selecao rotulo="Forma de pagamento" name="forma">
                <option value="">Não definida</option>
                {Object.entries(FORMA_PAGAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selecao>
              <Campo
                rotulo={tipo === "DESPESA" ? "Fornecedor" : "Origem"}
                name="fornecedor"
                className="sm:col-span-2"
              />
              <label className="flex items-center gap-2 pb-1 sm:col-span-1">
                <input
                  type="checkbox"
                  name="jaPago"
                  className="h-4 w-4 accent-[var(--color-marca-500)]"
                />
                <span className="text-sm text-carvao-800">Já foi pago</span>
              </label>
              <AreaTexto
                rotulo="Observações"
                name="observacoes"
                rows={2}
                className="sm:col-span-4"
              />
            </div>
            {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
            <Botao type="submit">Lançar</Botao>
          </form>
        )}
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo="Lançamentos"
          descricao={`${lancamentos.length} registro(s) no período`}
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Vencimento</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th>Forma</Th>
              <Th>Status</Th>
              <Th className="text-right">Valor</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {lancamentos.length === 0 && (
              <LinhaVazia colunas={7} mensagem="Nenhum lançamento no período." />
            )}
            {lancamentos.map((l) => (
              <tr key={l.id} className="hover:bg-carvao-50">
                <Td className="whitespace-nowrap text-carvao-600">
                  {data(l.vencimento)}
                  {l.pagamento && (
                    <span className="block text-xs text-emerald-700">
                      pago {data(l.pagamento)}
                    </span>
                  )}
                </Td>
                <Td>
                  <p className="font-medium text-carvao-950">{l.descricao}</p>
                  <p className="text-xs text-carvao-500">
                    {l.fornecedor && `${l.fornecedor} · `}
                    {l.ordem && (
                      <Link
                        href={`/sistema/ordens/${l.ordem.id}`}
                        className="font-semibold text-marca-600 hover:underline"
                      >
                        OS {numeroDoc(l.ordem.numero)}
                      </Link>
                    )}
                  </p>
                </Td>
                <Td className="text-carvao-600">{l.categoria?.nome ?? "—"}</Td>
                <Td className="text-carvao-600">
                  {l.forma ? FORMA_PAGAMENTO[l.forma] : "—"}
                </Td>
                <Td>
                  <Badge cor={STATUS_LANCAMENTO[l.status].cor}>
                    {STATUS_LANCAMENTO[l.status].label}
                  </Badge>
                </Td>
                <Td
                  className={`whitespace-nowrap text-right font-bold ${
                    l.tipo === "RECEITA" ? "text-emerald-700" : "text-marca-700"
                  }`}
                >
                  {l.tipo === "RECEITA" ? "+" : "−"} {brl(l.valor)}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <form action={baixarLancamentoAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="forma" value={l.forma ?? ""} />
                      <button
                        type="submit"
                        title={l.status === "PAGO" ? "Desfazer baixa" : "Dar baixa"}
                        className={`rounded p-1.5 transition ${
                          l.status === "PAGO"
                            ? "text-carvao-400 hover:bg-carvao-100 hover:text-carvao-700"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {l.status === "PAGO" ? (
                          <Undo2 className="h-4 w-4" aria-hidden />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden />
                        )}
                        <span className="sr-only">
                          {l.status === "PAGO" ? "Desfazer baixa" : "Dar baixa"} em{" "}
                          {l.descricao}
                        </span>
                      </button>
                    </form>
                    <form action={excluirLancamentoAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <button
                        type="submit"
                        className="rounded p-1.5 text-carvao-400 transition hover:bg-marca-50 hover:text-marca-600"
                        aria-label={`Excluir ${l.descricao}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
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
