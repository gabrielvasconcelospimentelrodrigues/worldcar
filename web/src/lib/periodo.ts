/**
 * Periodo dos relatorios.
 *
 * Vive fora do componente porque e funcao pura, e o Fast Refresh so funciona
 * em arquivo que exporta apenas componentes.
 *
 * Guardar como duas datas, e nao como "ultimos N meses", e o que permite
 * comparar com o periodo anterior de mesmo tamanho.
 */
export type Periodo = { inicio: string; fim: string; rotulo: string };

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** O fim e exclusivo: o dia seguinte ao ultimo dia contado. */
export function atalhoPeriodo(chave: string): Periodo {
  const hoje = new Date();
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const primeiroDesteMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  switch (chave) {
    case "mes": {
      return { inicio: iso(primeiroDesteMes), fim: iso(amanha), rotulo: "Este mês" };
    }
    case "mes_passado": {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      return { inicio: iso(ini), fim: iso(primeiroDesteMes), rotulo: "Mês passado" };
    }
    case "3m": {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      return { inicio: iso(ini), fim: iso(amanha), rotulo: "Últimos 3 meses" };
    }
    case "6m": {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      return { inicio: iso(ini), fim: iso(amanha), rotulo: "Últimos 6 meses" };
    }
    case "ano": {
      return {
        inicio: iso(new Date(hoje.getFullYear(), 0, 1)),
        fim: iso(amanha),
        rotulo: `Ano de ${hoje.getFullYear()}`,
      };
    }
    default: {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
      return { inicio: iso(ini), fim: iso(amanha), rotulo: "Últimos 12 meses" };
    }
  }
}

