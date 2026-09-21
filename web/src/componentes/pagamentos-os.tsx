import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Gift, Plus, X } from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Campo, Cartao, Selecao, Tabela, Td, Th,
} from "@/componentes/ui";
import { FORMA_PAGAMENTO } from "@/lib/constantes";
import { brl, dataHora } from "@/lib/format";
import { dinheiroParaNumero, mascararDinheiro } from "@/lib/mascaras";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Recebimentos de uma OS.
 *
 * Serve para dois momentos diferentes. Antes da entrega, o SINAL: funilaria
 * trabalha com entrada de 50% e esse dinheiro entrava na oficina sem passar
 * pelo sistema. Depois da entrega, o pagamento de quem ficou devendo.
 *
 * Nao existe tabela de pagamento: o recebimento e uma linha paga no
 * `lancamentos`, que ja e o livro-caixa. Duas fontes de verdade para o mesmo
 * dinheiro so dariam divergencia no fim do mes.
 */

type Recebimento = {
  id: string;
  descricao: string;
  valor: string;
  status: "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";
  forma: keyof typeof FORMA_PAGAMENTO | null;
  pagamento: string | null;
  vencimento: string;
  parcela: number | null;
  totalParcelas: number | null;
};

type Saldo = { total: number; pago: number; em_aberto: number; saldo: number };

const CORES: Record<string, string> = {
  PAGO: "bg-emerald-100 text-emerald-800",
  PENDENTE: "bg-amber-100 text-amber-800",
  ATRASADO: "bg-marca-100 text-marca-700",
  CANCELADO: "bg-carvao-200 text-carvao-600",
};

export function PagamentosOs({
  ordemId, clienteId, entregue, editavel, aoMudar,
}: {
  ordemId: string;
  clienteId: string;
  entregue: boolean;
  editavel: boolean;
  aoMudar: () => void;
}) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [linhas, setLinhas] = useState<Recebimento[]>([]);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("PIX");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pontos, setPontos] = useState<{ pontos: number; minimo: number; valor: number } | null>(null);

  const carregar = useCallback(async () => {
    const [s, l, f, pr] = await Promise.all([
      sb.rpc("saldo_ordem", { p_ordem_id: ordemId }),
      sb.from("lancamentos").select("*").eq("ordemId", ordemId)
        .eq("tipo", "RECEITA").order("vencimento"),
      sb.from("fidelidade_saldo").select("pontos").eq("clienteId", clienteId).maybeSingle(),
      sb.from("parametros_fidelidade")
        .select("ativo, valorDoPonto, minimoResgate").eq("id", "default").maybeSingle(),
    ]);
    setSaldo((s.data as Saldo) ?? null);
    setLinhas((l.data as Recebimento[]) ?? []);

    const par = pr.data as { ativo: boolean; valorDoPonto: string; minimoResgate: number } | null;
    const saldoPontos = Number((f.data as { pontos: number } | null)?.pontos ?? 0);
    setPontos(par?.ativo
      ? { pontos: saldoPontos, minimo: par.minimoResgate,
          valor: saldoPontos * Number(par.valorDoPonto) }
      : null);
  }, [ordemId, clienteId]);

  /** Troca o saldo inteiro por desconto na OS. */
  async function usarPontos() {
    if (!pontos) return;
    setOcupado(true); setErro(null); setOk(null);
    const { data: r, error } = await sb.rpc("resgatar_pontos", {
      p_cliente_id: clienteId, p_pontos: pontos.pontos, p_ordem_id: ordemId,
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const res = r as { valor: number; novo_total: number };
    setOk(`${pontos.pontos} pontos aplicados: ${brl(res.valor)} de desconto. Novo total ${brl(res.novo_total)}.`);
    await carregar();
    aoMudar();
  }

  useEffect(() => { void carregar(); }, [carregar]);

  async function registrar() {
    const v = dinheiroParaNumero(valor);
    if (v <= 0) return setErro("Informe o valor recebido.");
    setOcupado(true); setErro(null);
    const { error } = await sb.rpc("registrar_pagamento", {
      p_ordem_id: ordemId, p_valor: v, p_forma: forma,
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setAberto(false);
    setValor("");
    await carregar();
    aoMudar();
  }

  /** Baixa de uma parcela que ja estava lancada. */
  async function baixar(r: Recebimento) {
    setOcupado(true); setErro(null);
    const { error } = await sb.from("lancamentos")
      .update({ status: "PAGO", pagamento: new Date().toISOString(),
        atualizadoEm: new Date().toISOString() })
      .eq("id", r.id);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    await carregar();
    aoMudar();
  }

  const emAberto = saldo ? Number(saldo.em_aberto) : 0;
  const pago = saldo ? Number(saldo.pago) : 0;
  const total = saldo ? Number(saldo.total) : 0;
  const falta = Math.max(0, total - pago);
  const quitada = total > 0 && falta < 0.005;

  return (
    <Cartao className="mt-6">
      <CabecalhoCartao
        titulo="Pagamentos"
        descricao={entregue
          ? "O que já entrou e o que falta receber."
          : "Registre aqui o sinal, antes da entrega."}
        acao={
          editavel && !aberto && !quitada && (
            <Botao type="button" variante="fantasma" onClick={() => setAberto(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {entregue ? "Registrar pagamento" : "Registrar sinal"}
            </Botao>
          )
        }
      />

      <div className="grid gap-4 border-b border-carvao-200 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Total da OS
          </p>
          <p className="mt-1 text-lg font-bold text-carvao-950">{brl(total)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Já recebido
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{brl(pago)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Falta receber
          </p>
          <p className={`mt-1 text-lg font-bold ${
            quitada ? "text-emerald-700" : "text-marca-600"}`}>
            {quitada ? "Quitada" : brl(falta)}
          </p>
          {emAberto > 0 && !quitada && (
            <p className="text-xs text-carvao-500">{brl(emAberto)} já em cobrança</p>
          )}
        </div>
      </div>

      {erro && <div className="px-5 pt-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="px-5 pt-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      {/* Pontos so viram desconto antes da entrega: depois, a conta ja fechou.
          O atendente precisa ver isso na hora de cobrar, nao em outra tela. */}
      {editavel && !entregue && pontos && pontos.pontos >= pontos.minimo && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-carvao-200 bg-amber-50 px-5 py-3">
          <p className="text-sm text-amber-900">
            <strong>{pontos.pontos.toLocaleString("pt-BR")} pontos</strong> de fidelidade
            disponíveis — valem {brl(pontos.valor)} de desconto nesta OS.
          </p>
          <Botao type="button" variante="fantasma" disabled={ocupado}
            onClick={() => void usarPontos()} className="px-3 py-1.5 text-xs">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            Usar pontos
          </Botao>
        </div>
      )}

      {aberto && (
        <div className="flex flex-wrap items-end gap-3 border-b border-carvao-200 bg-carvao-50 p-5">
          <Campo rotulo="Valor recebido" value={valor} className="w-40"
            inputMode="decimal" placeholder="0,00"
            onChange={(e) => setValor(mascararDinheiro(e.target.value))}
            dica={`Falta ${brl(falta)}`} />
          <Selecao rotulo="Forma" value={forma} className="w-44"
            onChange={(e) => setForma(e.target.value)}>
            {Object.entries(FORMA_PAGAMENTO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Selecao>
          <div className="flex items-center gap-2 pb-0.5">
            <Botao type="button" disabled={ocupado} onClick={() => void registrar()}>
              <BadgeDollarSign className="h-4 w-4" aria-hidden />
              Confirmar
            </Botao>
            <button type="button" onClick={() => { setAberto(false); setErro(null); }}
              className="rounded p-2 text-carvao-500 hover:text-carvao-900"
              aria-label="Cancelar">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-carvao-500">
          {entregue
            ? "Nenhum recebimento lançado."
            : "Nenhum sinal recebido. O valor total será cobrado na entrega."}
        </p>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Descrição</Th>
              <Th>Forma</Th>
              <Th>Data</Th>
              <Th className="text-right">Valor</Th>
              <Th>Situação</Th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => (
              <tr key={r.id} className="hover:bg-carvao-50">
                <Td>
                  <p className="text-carvao-800">{r.descricao}</p>
                  {r.parcela && r.totalParcelas && (
                    <p className="text-xs text-carvao-500">
                      Parcela {r.parcela} de {r.totalParcelas}
                    </p>
                  )}
                </Td>
                <Td className="text-carvao-600">
                  {r.forma ? FORMA_PAGAMENTO[r.forma] : "—"}
                </Td>
                <Td className="whitespace-nowrap text-carvao-600">
                  {r.pagamento ? dataHora(r.pagamento) : `vence ${dataHora(r.vencimento)}`}
                </Td>
                <Td className="text-right font-semibold text-carvao-950">{brl(r.valor)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Badge cor={CORES[r.status]}>{r.status}</Badge>
                    {editavel && r.status !== "PAGO" && r.status !== "CANCELADO" && (
                      <button type="button" disabled={ocupado}
                        onClick={() => void baixar(r)}
                        className="text-xs font-semibold text-marca-600 hover:underline">
                        dar baixa
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </Cartao>
  );
}
