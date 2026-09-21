import { Campo, Selecao } from "@/componentes/ui";
import { type Periodo } from "@/lib/periodo";

/**
 * Barra de periodo dos relatorios.
 *
 * Os atalhos cobrem o que se pergunta no dia a dia — "como foi o mes", "como
 * esta o ano" — e o intervalo livre existe para o resto. Guardar o periodo como
 * duas datas, e nao como "ultimos N meses", e o que permite comparar com o
 * periodo anterior de mesmo tamanho.
 */

const ATALHOS = [
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_passado", rotulo: "Mês passado" },
  { valor: "3m", rotulo: "3 meses" },
  { valor: "6m", rotulo: "6 meses" },
  { valor: "12m", rotulo: "12 meses" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "livre", rotulo: "Escolher datas" },
];

export function BarraPeriodo({
  atalho, periodo, aoMudarAtalho, aoMudarData,
}: {
  atalho: string;
  periodo: Periodo;
  aoMudarAtalho: (v: string) => void;
  aoMudarData: (campo: "inicio" | "fim", valor: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-carvao-200 bg-white p-4">
      <Selecao rotulo="Período" value={atalho} className="w-44"
        onChange={(e) => aoMudarAtalho(e.target.value)}>
        {ATALHOS.map((a) => (
          <option key={a.valor} value={a.valor}>{a.rotulo}</option>
        ))}
      </Selecao>

      {atalho === "livre" ? (
        <>
          <Campo rotulo="De" type="date" value={periodo.inicio} className="w-40"
            onChange={(e) => aoMudarData("inicio", e.target.value)} />
          <Campo rotulo="Até" type="date" value={periodo.fim} className="w-40"
            onChange={(e) => aoMudarData("fim", e.target.value)} />
        </>
      ) : (
        <p className="pb-2 text-sm text-carvao-500">
          {new Date(`${periodo.inicio}T12:00`).toLocaleDateString("pt-BR")} a{" "}
          {new Date(`${periodo.fim}T12:00`).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}
