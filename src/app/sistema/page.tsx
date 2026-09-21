import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  Car,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sincronizarPendencias } from "@/lib/negocio";
import {
  Aviso,
  Badge,
  Cartao,
  CabecalhoCartao,
  Indicador,
  LinhaVazia,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { STATUS_OS, STATUS_ORCAMENTO, TIPO_ALERTA } from "@/lib/constantes";
import { brl, data, fimDoMes, inicioDoMes, num, numeroDoc } from "@/lib/format";

export const dynamic = "force-dynamic";

async function carregar() {
  await sincronizarPendencias();

  const agora = new Date();
  const de = inicioDoMes(agora);
  const ate = fimDoMes(agora);
  const fimDeHoje = new Date(agora);
  fimDeHoje.setHours(23, 59, 59, 999);

  const [
    osAtivas,
    osProntas,
    orcamentosAbertos,
    receitaMes,
    despesaMes,
    aReceber,
    alertas,
    ordensRecentes,
    orcamentosRecentes,
  ] = await Promise.all([
    prisma.ordemServico.count({
      where: { status: { in: ["AGUARDANDO", "EM_ANDAMENTO", "PAUSADA"] } },
    }),
    prisma.ordemServico.count({ where: { status: "PRONTA" } }),
    prisma.orcamento.count({ where: { status: { in: ["RASCUNHO", "ENVIADO"] } } }),
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
    prisma.alerta.findMany({
      where: { status: "PENDENTE", dataAlvo: { lte: fimDeHoje } },
      include: { cliente: true, veiculo: true },
      orderBy: { dataAlvo: "asc" },
      take: 8,
    }),
    prisma.ordemServico.findMany({
      where: { status: { notIn: ["ENTREGUE", "CANCELADA"] } },
      include: { cliente: true, veiculo: true, funcionarioEntrada: true },
      orderBy: { dataEntrada: "desc" },
      take: 8,
    }),
    prisma.orcamento.findMany({
      where: { status: { in: ["RASCUNHO", "ENVIADO"] } },
      include: { cliente: true, veiculo: true },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
  ]);

  const receita = num(receitaMes._sum.valor);
  const despesa = num(despesaMes._sum.valor);

  return {
    osAtivas,
    osProntas,
    orcamentosAbertos,
    receita,
    despesa,
    resultado: receita - despesa,
    aReceber: num(aReceber._sum.valor),
    alertas,
    ordensRecentes,
    orcamentosRecentes,
  };
}

export default async function PainelPage() {
  const sessao = await lerSessao();

  let d: Awaited<ReturnType<typeof carregar>>;
  try {
    d = await carregar();
  } catch {
    return (
      <>
        <TituloPagina titulo="Painel" />
        <Aviso tipo="erro">
          Não foi possível ler os dados. Confira <code>DATABASE_URL</code> no{" "}
          <code>.env.local</code> e rode <code>npm run db:push</code> seguido de{" "}
          <code>npm run db:seed</code>.
        </Aviso>
      </>
    );
  }

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <>
      <TituloPagina
        titulo={`Olá, ${sessao?.nome.split(" ")[0] ?? ""}`}
        descricao="Visão geral da oficina hoje."
      />

      {/* Indicadores operacionais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Veículos na oficina"
          valor={String(d.osAtivas)}
          detalhe="OS aguardando, em andamento ou pausadas"
          icone={<Car className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Prontos para retirada"
          valor={String(d.osProntas)}
          detalhe="Avisar o cliente"
          destaque={d.osProntas > 0}
        />
        <Indicador
          rotulo="Orçamentos em aberto"
          valor={String(d.orcamentosAbertos)}
          detalhe="Rascunho ou enviado"
          icone={<FileText className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Alertas para hoje"
          valor={String(d.alertas.length)}
          detalhe="Retornos e pós-venda"
          destaque={d.alertas.length > 0}
          icone={<BellRing className="h-5 w-5" aria-hidden />}
        />
      </div>

      {/* Indicadores financeiros */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo={`Receita de ${mes}`}
          valor={brl(d.receita)}
          detalhe="Recebimentos confirmados"
          icone={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo={`Despesa de ${mes}`}
          valor={brl(d.despesa)}
          detalhe="Pagamentos efetuados"
          icone={<TrendingDown className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Resultado do mês"
          valor={brl(d.resultado)}
          detalhe={d.resultado >= 0 ? "No azul" : "No vermelho"}
          destaque={d.resultado < 0}
        />
        <Indicador rotulo="A receber" valor={brl(d.aReceber)} detalhe="Pendente + atrasado" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Oficina agora */}
        <Cartao>
          <CabecalhoCartao
            titulo="Na oficina agora"
            descricao="Ordens de serviço em aberto"
            acao={
              <Link
                href="/sistema/ordens"
                className="text-sm font-semibold text-marca-600 hover:text-marca-700"
              >
                Ver todas
              </Link>
            }
          />
          <Tabela>
            <thead>
              <tr>
                <Th>OS</Th>
                <Th>Cliente / veículo</Th>
                <Th>Entrada</Th>
                <Th>Recebido por</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {d.ordensRecentes.length === 0 && (
                <LinhaVazia colunas={5} mensagem="Nenhum veículo em serviço." />
              )}
              {d.ordensRecentes.map((o) => (
                <tr key={o.id} className="hover:bg-carvao-50">
                  <Td>
                    <Link
                      href={`/sistema/ordens/${o.id}`}
                      className="font-semibold text-marca-600 hover:underline"
                    >
                      {numeroDoc(o.numero)}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium">{o.cliente.nome}</p>
                    <p className="text-xs text-carvao-500">
                      {o.veiculo.marca} {o.veiculo.modelo} · {o.veiculo.placa}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-carvao-600">
                    {data(o.dataEntrada)}
                  </Td>
                  <Td className="text-carvao-600">{o.funcionarioEntrada.nome}</Td>
                  <Td>
                    <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Cartao>

        {/* Alertas */}
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao
              titulo="Alertas de hoje"
              acao={
                <Link
                  href="/sistema/alertas"
                  className="text-sm font-semibold text-marca-600 hover:text-marca-700"
                >
                  Ver todos
                </Link>
              }
            />
            <ul className="divide-y divide-carvao-100">
              {d.alertas.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-carvao-500">
                  Nenhum alerta pendente. Tudo em dia.
                </li>
              )}
              {d.alertas.map((a) => {
                const vencido = a.dataAlvo < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <li key={a.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-2">
                      {vencido && (
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-marca-600"
                          aria-label="Vencido"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-carvao-900">
                          {a.titulo}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge cor={TIPO_ALERTA[a.tipo].cor}>
                            {TIPO_ALERTA[a.tipo].label}
                          </Badge>
                          <span
                            className={`text-xs ${vencido ? "font-semibold text-marca-600" : "text-carvao-500"}`}
                          >
                            {data(a.dataAlvo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Cartao>

          <Cartao>
            <CabecalhoCartao
              titulo="Orçamentos em aberto"
              acao={
                <Link
                  href="/sistema/orcamentos"
                  className="text-sm font-semibold text-marca-600 hover:text-marca-700"
                >
                  Ver todos
                </Link>
              }
            />
            <ul className="divide-y divide-carvao-100">
              {d.orcamentosRecentes.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-carvao-500">
                  Nenhum orçamento em aberto.
                </li>
              )}
              {d.orcamentosRecentes.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/sistema/orcamentos/${o.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-carvao-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-carvao-900">
                        {numeroDoc(o.numero)} · {o.cliente.nome}
                      </p>
                      <p className="mt-1 text-xs text-carvao-500">
                        {o.veiculo.placa} · válido até {data(o.validoAte)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-carvao-950">{brl(o.total)}</p>
                      <Badge cor={STATUS_ORCAMENTO[o.status].cor} className="mt-1">
                        {STATUS_ORCAMENTO[o.status].label}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
