import Link from "next/link";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sincronizarPendencias } from "@/lib/negocio";
import { Cartao, CabecalhoCartao, Indicador, TituloPagina } from "@/components/ui";
import { brl, fimDoMes, inicioDoMes, num } from "@/lib/format";
import { PainelFinanceiro, type LancamentoItem } from "./painel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

/** "2026-09" -> intervalo do mês; sem parâmetro usa o mês corrente. */
function periodo(mes?: string) {
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [a, m] = mes.split("-").map(Number);
    const ref = new Date(a, m - 1, 1);
    return { de: inicioDoMes(ref), ate: fimDoMes(ref), ref };
  }
  const agora = new Date();
  return { de: inicioDoMes(agora), ate: fimDoMes(agora), ref: agora };
}

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await exigirModulo("financeiro");
  await sincronizarPendencias();

  const { mes } = await searchParams;
  const { de, ate, ref } = periodo(mes);

  const [lancamentos, categorias, recebido, pago, aReceber, aPagar, atrasados] =
    await Promise.all([
      prisma.lancamento.findMany({
        where: { vencimento: { gte: de, lte: ate } },
        include: {
          categoria: { select: { nome: true } },
          ordem: { select: { id: true, numero: true } },
        },
        orderBy: { vencimento: "asc" },
      }),
      prisma.categoriaFinanceira.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        where: { tipo: "RECEITA", status: "PAGO", pagamento: { gte: de, lte: ate } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        where: { tipo: "DESPESA", status: "PAGO", pagamento: { gte: de, lte: ate } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        where: { tipo: "RECEITA", status: { in: ["PENDENTE", "ATRASADO"] } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        where: { tipo: "DESPESA", status: { in: ["PENDENTE", "ATRASADO"] } },
      }),
      prisma.lancamento.count({ where: { status: "ATRASADO" } }),
    ]);

  const totalRecebido = num(recebido._sum.valor);
  const totalPago = num(pago._sum.valor);
  const resultado = totalRecebido - totalPago;

  // Despesas por categoria no período, para leitura rápida de onde sai o dinheiro.
  const porCategoria = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== "DESPESA") continue;
    const nome = l.categoria?.nome ?? "Sem categoria";
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + num(l.valor));
  }
  const ranking = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maiorDespesa = ranking[0]?.[1] ?? 1;

  const anterior = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const proximo = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const nomeMes = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <TituloPagina
        titulo="Financeiro"
        descricao="Contas a pagar e a receber. As receitas de OS entram automaticamente na entrega."
        acao={
          <div className="flex items-center gap-1 rounded-md border border-carvao-300 bg-white">
            <Link
              href={`/sistema/financeiro?mes=${chaveMes(anterior)}`}
              className="px-3 py-2 text-sm font-semibold text-carvao-600 hover:text-marca-600"
            >
              ←
            </Link>
            <span className="min-w-36 text-center text-sm font-semibold capitalize text-carvao-950">
              {nomeMes}
            </span>
            <Link
              href={`/sistema/financeiro?mes=${chaveMes(proximo)}`}
              className="px-3 py-2 text-sm font-semibold text-carvao-600 hover:text-marca-600"
            >
              →
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Recebido no mês"
          valor={brl(totalRecebido)}
          icone={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Pago no mês"
          valor={brl(totalPago)}
          icone={<TrendingDown className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Resultado do mês"
          valor={brl(resultado)}
          detalhe={resultado >= 0 ? "Saldo positivo" : "Saldo negativo"}
          destaque={resultado < 0}
          icone={<Wallet className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Em atraso"
          valor={String(atrasados)}
          detalhe="Lançamentos vencidos"
          destaque={atrasados > 0}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Indicador
          rotulo="A receber (total)"
          valor={brl(num(aReceber._sum.valor))}
          detalhe="Pendentes e atrasados de todos os meses"
        />
        <Indicador
          rotulo="A pagar (total)"
          valor={brl(num(aPagar._sum.valor))}
          detalhe="Pendentes e atrasados de todos os meses"
        />
      </div>

      {ranking.length > 0 && (
        <Cartao className="mt-6">
          <CabecalhoCartao
            titulo="Despesas por categoria"
            descricao={`No mês de ${nomeMes}`}
          />
          <ul className="space-y-3 p-5">
            {ranking.map(([nome, valor]) => (
              <li key={nome}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-carvao-700">{nome}</span>
                  <span className="font-semibold text-carvao-950">{brl(valor)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-carvao-100">
                  <div
                    className="h-full rounded-full bg-marca-500"
                    style={{ width: `${(valor / maiorDespesa) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <div className="mt-6">
        <PainelFinanceiro
          categorias={categorias}
          lancamentos={lancamentos.map((l) => ({
            ...l,
            valor: num(l.valor),
          })) as unknown as LancamentoItem[]}
        />
      </div>
    </>
  );
}
