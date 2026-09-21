import { num } from "./format";
import type {
  CotacaoFornecedor, CotacaoItem, CotacaoPreco, Fornecedor,
} from "./tipos";

/**
 * Monta o mapa comparativo da cotação: a matriz item x fornecedor, o melhor
 * preço de cada linha e o total de cada coluna.
 *
 * Fica separado das telas porque o PDF precisa exatamente do mesmo cálculo —
 * se divergirem, o papel diz uma coisa e a tela outra.
 */

export type ColunaFornecedor = {
  cf: CotacaoFornecedor;
  fornecedor: Fornecedor | undefined;
  /** Soma dos itens que ele cotou e tem disponíveis. */
  subtotal: number;
  /** subtotal + frete − desconto. É por este que se compara. */
  total: number;
  /** Quantos dos itens pedidos ele conseguiu cotar. */
  itensCotados: number;
  respondeu: boolean;
  /** True quando ele não cotou tudo — comparar total seria injusto. */
  parcial: boolean;
};

export type CelulaPreco = {
  preco: CotacaoPreco | undefined;
  precoUnit: number;
  totalLinha: number;
  disponivel: boolean;
  /** Menor preço daquele item entre todos os fornecedores. */
  melhorDoItem: boolean;
  /** Original, paralela, fabricante — preço só se compara sabendo o quê. */
  marca: string | null;
  /** Prazo de entrega em dias: a mais barata que chega tarde não serve. */
  prazoDias: number | null;
};

export type LinhaComparativo = {
  item: CotacaoItem;
  celulas: Map<string, CelulaPreco>;
  melhorPreco: number | null;
  /** Diferença entre o mais caro e o mais barato do item, em reais. */
  amplitude: number;
};

export type Comparativo = {
  colunas: ColunaFornecedor[];
  linhas: LinhaComparativo[];
  /** Coluna de menor total entre quem cotou tudo. */
  melhorTotal: ColunaFornecedor | null;
  /** Soma dos menores preços item a item — o piso teórico, comprando dividido. */
  totalPorItem: number;
  /** Quanto se economiza dividindo a compra em vez de fechar com o melhor total. */
  economiaDividindo: number;
};

export function montarComparativo(
  itens: CotacaoItem[],
  cotacaoFornecedores: CotacaoFornecedor[],
  precos: CotacaoPreco[],
  fornecedores: Fornecedor[],
): Comparativo {
  const porItemFornecedor = new Map<string, CotacaoPreco>();
  for (const p of precos) {
    porItemFornecedor.set(`${p.cotacaoItemId}:${p.cotacaoFornecedorId}`, p);
  }

  // --- linhas: um item por linha, com o preço de cada fornecedor ---
  const linhas: LinhaComparativo[] = itens.map((item) => {
    const celulas = new Map<string, CelulaPreco>();
    const validos: number[] = [];

    for (const cf of cotacaoFornecedores) {
      const preco = porItemFornecedor.get(`${item.id}:${cf.id}`);
      const precoUnit = num(preco?.precoUnit);
      const disponivel = Boolean(preco && preco.disponivel && precoUnit > 0);
      if (disponivel) validos.push(precoUnit);

      celulas.set(cf.id, {
        preco,
        precoUnit,
        totalLinha: precoUnit * num(item.quantidade),
        disponivel,
        melhorDoItem: false,
        marca: preco?.marca ?? null,
        prazoDias: preco?.prazoDias ?? null,
      });
    }

    const melhorPreco = validos.length > 0 ? Math.min(...validos) : null;
    if (melhorPreco !== null) {
      for (const c of celulas.values()) {
        if (c.disponivel && c.precoUnit === melhorPreco) c.melhorDoItem = true;
      }
    }

    return {
      item,
      celulas,
      melhorPreco,
      amplitude: validos.length > 1 ? Math.max(...validos) - Math.min(...validos) : 0,
    };
  });

  // --- colunas: um fornecedor por coluna, com o total dele ---
  const colunas: ColunaFornecedor[] = cotacaoFornecedores.map((cf) => {
    let subtotal = 0;
    let itensCotados = 0;

    for (const linha of linhas) {
      const c = linha.celulas.get(cf.id);
      if (c?.disponivel) {
        subtotal += c.totalLinha;
        itensCotados += 1;
      }
    }

    const total = Math.max(0, subtotal + num(cf.frete) - num(cf.desconto));

    return {
      cf,
      fornecedor: fornecedores.find((f) => f.id === cf.fornecedorId),
      subtotal,
      total,
      itensCotados,
      respondeu: Boolean(cf.respondidoEm) || itensCotados > 0,
      parcial: itensCotados > 0 && itensCotados < itens.length,
    };
  });

  // Só compete pelo melhor total quem cotou a lista inteira: comparar o total
  // de quem cotou 2 de 5 itens com o de quem cotou os 5 seria enganoso.
  const completos = colunas.filter((c) => c.respondeu && !c.parcial && c.itensCotados > 0);
  const melhorTotal = completos.length > 0
    ? completos.reduce((a, b) => (b.total < a.total ? b : a))
    : null;

  const totalPorItem = linhas.reduce(
    (s, l) => s + (l.melhorPreco ?? 0) * num(l.item.quantidade), 0);

  return {
    colunas,
    linhas,
    melhorTotal,
    totalPorItem,
    economiaDividindo: melhorTotal ? Math.max(0, melhorTotal.total - totalPorItem) : 0,
  };
}
