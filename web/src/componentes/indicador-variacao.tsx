import { Minus, TrendingDown, TrendingUp } from "lucide-react";

/**
 * Indicador com variacao sobre o periodo anterior.
 *
 * "R$ 180 mil no mes" pode ser o melhor mes do ano ou uma queda de 20% — sem o
 * periodo anterior ao lado ninguem sabe qual dos dois. Toda leitura de gestao e
 * comparativa, entao o numero nunca aparece sozinho.
 */
export function IndicadorVariacao({
  rotulo, valor, atual, anterior, detalhe, inverso,
}: {
  rotulo: string;
  /** Ja formatado para exibir (moeda, percentual, contagem). */
  valor: string;
  atual: number;
  anterior: number;
  detalhe?: string;
  /** Para metricas em que subir e ruim, como prazo ou retrabalho. */
  inverso?: boolean;
}) {
  // Variacao acima de 500% quase sempre significa que o periodo anterior mal
  // teve movimento — o primeiro ano de operacao comparado com o "ano zero", por
  // exemplo. Mostrar "+3086%" nao informa nada e ainda passa a impressao de que
  // o sistema calculou errado. Melhor dizer que nao ha base.
  const bruto = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
  const temBase = anterior > 0 && Math.abs(bruto) < 500;
  const variacao = bruto;
  const subiu = variacao > 0.05;
  const desceu = variacao < -0.05;
  const bom = inverso ? desceu : subiu;
  const ruim = inverso ? subiu : desceu;

  const Icone = subiu ? TrendingUp : desceu ? TrendingDown : Minus;

  return (
    <div className="rounded-md border border-carvao-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-carvao-950">{valor}</p>

      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {temBase ? (
          <>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold ${
              bom ? "bg-emerald-100 text-emerald-800"
                : ruim ? "bg-marca-100 text-marca-700"
                  : "bg-carvao-100 text-carvao-600"}`}>
              <Icone className="h-3 w-3" aria-hidden />
              {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
            </span>
            <span className="text-carvao-500">vs. período anterior</span>
          </>
        ) : (
          <span className="text-carvao-400">
            {anterior > 0 ? "período anterior sem movimento comparável" : "sem base de comparação"}
          </span>
        )}
      </div>

      {detalhe && <p className="mt-1 text-xs text-carvao-500">{detalhe}</p>}
    </div>
  );
}
