import { useEffect, useState } from "react";
import { CabecalhoCartao, Cartao, Selecao } from "@/componentes/ui";
import { brl } from "@/lib/format";
import { sb } from "@/lib/supabase";

/**
 * Demonstrativo do mes e fluxo de caixa.
 *
 * Somar receita menos despesa diz se sobrou dinheiro, mas nao diz por que. Um
 * mes ruim por queda de movimento e um mes ruim por estouro no custo de peca
 * pedem decisoes opostas, e os dois apareciam como "resultado menor".
 *
 * Separar por natureza resolve: custo variavel acompanha o faturamento, pessoal
 * e fixa seguem correndo com o patio vazio. Os percentuais sobre a receita sao
 * o que permite comparar meses de tamanhos diferentes — R$ 80 mil de pessoal
 * significa coisas bem distintas num mes de 100 mil e num de 200 mil.
 */

type Dre = {
  competencia: string;
  receita: number;
  custo_variavel: number;
  margem_bruta: number;
  pessoal: number;
  fixas: number;
  impostos: number;
  outras: number;
  despesa_total: number;
  resultado: number;
  pct_custo_variavel: number;
  pct_pessoal: number;
  pct_fixas: number;
  pct_margem: number;
};

type Mes = { mes: string; receita: number; despesa: number; resultado: number };

function competenciasRecentes() {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const porExtenso = (c: string) => {
  const [ano, mes] = c.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

const curto = (c: string) => {
  const [ano, mes] = c.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

/** Uma linha do demonstrativo, com barra proporcional a receita. */
function Linha({
  rotulo, valor, pct, negativo, forte, recuado,
}: {
  rotulo: string;
  valor: number;
  pct?: number;
  negativo?: boolean;
  forte?: boolean;
  recuado?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-2 ${forte ? "bg-carvao-50" : ""}`}>
      <span className={`flex-1 text-sm ${recuado ? "pl-4 text-carvao-600" : ""} ${
        forte ? "font-bold text-carvao-950" : "text-carvao-700"}`}>
        {rotulo}
      </span>
      {pct !== undefined && (
        <span className="hidden w-32 sm:block" aria-hidden>
          <span className="block h-1.5 w-full rounded-full bg-carvao-100">
            <span
              className={`block h-1.5 rounded-full ${negativo ? "bg-marca-400" : "bg-emerald-400"}`}
              style={{ width: `${Math.min(100, Math.abs(pct))}%` }}
            />
          </span>
        </span>
      )}
      <span className="w-14 text-right text-xs text-carvao-500">
        {pct !== undefined ? `${pct}%` : ""}
      </span>
      <span className={`w-32 text-right tabular-nums ${
        forte ? "text-base font-bold" : "text-sm"} ${
        negativo ? "text-marca-600" : valor < 0 ? "text-marca-600" : "text-carvao-950"}`}>
        {negativo && valor > 0 ? `− ${brl(valor)}` : brl(valor)}
      </span>
    </div>
  );
}

export function Demonstrativo() {
  const COMPETENCIAS = competenciasRecentes();
  const [competencia, setCompetencia] = useState(COMPETENCIAS[0]);
  const [dre, setDre] = useState<Dre | null>(null);
  const [fluxo, setFluxo] = useState<Mes[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [d, f] = await Promise.all([
        sb.rpc("dre_mensal", { p_competencia: competencia }),
        sb.rpc("fluxo_caixa", { p_meses: 12 }),
      ]);
      if (!vivo) return;
      setDre((d.data as Dre) ?? null);
      setFluxo((f.data as Mes[]) ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [competencia]);

  // A maior barra define a escala; sem isso um mes forte achataria todos os outros.
  const teto = Math.max(1, ...fluxo.flatMap((m) => [Number(m.receita), Number(m.despesa)]));

  return (
    <div className="space-y-6">
      <Cartao>
        <CabecalhoCartao
          titulo="Demonstrativo do mês"
          descricao="Pelo que foi efetivamente pago e recebido — o que passou pela conta."
          acao={
            <Selecao rotulo="Mês" value={competencia} className="w-44"
              onChange={(e) => setCompetencia(e.target.value)}>
              {COMPETENCIAS.map((c) => (
                <option key={c} value={c}>{porExtenso(c)}</option>
              ))}
            </Selecao>
          }
        />

        {carregando || !dre ? (
          <p className="px-5 py-10 text-center text-sm text-carvao-500">Carregando...</p>
        ) : Number(dre.receita) === 0 && Number(dre.despesa_total) === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-carvao-500">
            Nenhum movimento pago ou recebido em {porExtenso(competencia)}.
          </p>
        ) : (
          <div className="divide-y divide-carvao-100 py-1">
            <Linha rotulo="Receita de serviços" valor={Number(dre.receita)} forte />
            <Linha rotulo="Peças e insumos" valor={Number(dre.custo_variavel)}
              pct={Number(dre.pct_custo_variavel)} negativo recuado />
            <Linha rotulo="Margem bruta" valor={Number(dre.margem_bruta)} forte />
            <Linha rotulo="Pessoal (salários, comissões e encargos)"
              valor={Number(dre.pessoal)} pct={Number(dre.pct_pessoal)} negativo recuado />
            <Linha rotulo="Despesas fixas" valor={Number(dre.fixas)}
              pct={Number(dre.pct_fixas)} negativo recuado />
            <Linha rotulo="Impostos" valor={Number(dre.impostos)} negativo recuado />
            {Number(dre.outras) > 0 && (
              <Linha rotulo="Outras despesas" valor={Number(dre.outras)} negativo recuado />
            )}
            <Linha rotulo="Resultado do mês" valor={Number(dre.resultado)}
              pct={Number(dre.pct_margem)} forte />
          </div>
        )}

        {dre && Number(dre.receita) > 0 && (
          <p className="border-t border-carvao-200 px-5 py-3 text-xs text-carvao-500">
            Cada R$ 100 faturados: R$ {Number(dre.pct_custo_variavel).toFixed(0)} em peças,
            R$ {Number(dre.pct_pessoal).toFixed(0)} em pessoal,
            R$ {Number(dre.pct_fixas).toFixed(0)} em despesas fixas —
            sobram R$ {Number(dre.pct_margem).toFixed(0)}.
          </p>
        )}
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Fluxo de caixa"
          descricao="Entradas e saídas dos últimos 12 meses." />
        {fluxo.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-carvao-500">Sem movimento.</p>
        ) : (
          <div className="overflow-x-auto p-5">
            <div className="flex min-w-[640px] items-end gap-3">
              {fluxo.map((m) => {
                const receita = Number(m.receita);
                const despesa = Number(m.despesa);
                const resultado = Number(m.resultado);
                return (
                  <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                    <span className={`text-[10px] font-bold tabular-nums ${
                      resultado < 0 ? "text-marca-600" : "text-emerald-700"}`}>
                      {resultado < 0 ? "−" : "+"}
                      {Math.abs(Math.round(resultado / 1000))}k
                    </span>
                    <div className="flex h-40 w-full items-end justify-center gap-1">
                      <div
                        className="w-1/2 rounded-t bg-emerald-400"
                        style={{ height: `${(receita / teto) * 100}%` }}
                        title={`Receita ${brl(receita)}`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-carvao-400"
                        style={{ height: `${(despesa / teto) * 100}%` }}
                        title={`Despesa ${brl(despesa)}`}
                      />
                    </div>
                    <span className="text-[11px] text-carvao-500">{curto(m.mes)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-carvao-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" aria-hidden />
                Recebido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-carvao-400" aria-hidden />
                Pago
              </span>
            </div>
          </div>
        )}
      </Cartao>
    </div>
  );
}
