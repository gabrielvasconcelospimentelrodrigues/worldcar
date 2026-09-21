import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown } from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { BarraPeriodo } from "@/componentes/periodo";
import { atalhoPeriodo, type Periodo } from "@/lib/periodo";
import { IndicadorVariacao } from "@/componentes/indicador-variacao";
import { reservarAba } from "@/pdf/aba";
import { brl, data, telefone } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Relatorios.
 *
 * Tudo mede o que foi RECEBIDO, nao o que foi faturado: ranking por valor
 * cobrado coloca no topo quem gera nota e nao paga.
 *
 * A tela e dividida em abas porque as perguntas sao diferentes e raramente
 * simultaneas. Quem fecha o mes olha a visao geral; quem vai ligar para cliente
 * sumido olha clientes; quem faz avaliacao olha equipe. Empilhar tudo numa
 * rolagem so obriga todo mundo a passar pelo que nao interessa.
 */

type Janela = {
  recebido: number; ordens: number; clientes: number; itens: number;
  ticket: number; orcamentos: number; convertidos: number; conversao: number;
};
type Comparado = {
  atual: Janela; anterior: Janela;
  inicio: string; fim: string; inicio_anterior: string; fim_anterior: string;
};
type Evolucao = { mes: string; recebido: number; ordens: number; ticket: number; novos: number };
type ClienteRank = {
  id: string; nome: string; telefone: string; tipo: string; gasto: number;
  visitas: number; ticket: number; ultima: string | null; dias_sem_vir: number;
};
type FuncRank = {
  id: string; nome: string; cargo: string; setor: string; servicos: number;
  producao: number; comissao: number; conferidas: number; reprovadas: number;
  pct_retrabalho: number;
};
type ServicoRank = {
  nome: string; categoria: string; vezes: number; faturamento: number; preco_medio: number;
};

type Aba = "geral" | "clientes" | "equipe" | "servicos";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "geral", rotulo: "Visão geral" },
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "equipe", rotulo: "Equipe" },
  { chave: "servicos", rotulo: "Serviços" },
];

const MEDALHA = ["bg-amber-100 text-amber-800", "bg-carvao-200 text-carvao-700",
  "bg-orange-100 text-orange-800"];

const mesCurto = (c: string) => {
  const [ano, mes] = c.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

export function Relatorios() {
  const [aba, setAba] = useState<Aba>("geral");
  // Tres meses por padrao: o periodo anterior de mesmo tamanho existe e tem
  // movimento, entao a comparacao ja diz algo na primeira abertura.
  const [atalho, setAtalho] = useState("3m");
  const [periodo, setPeriodo] = useState<Periodo>(() => atalhoPeriodo("3m"));

  const [comp, setComp] = useState<Comparado | null>(null);
  const [evolucao, setEvolucao] = useState<Evolucao[]>([]);
  const [clientes, setClientes] = useState<ClienteRank[]>([]);
  const [equipe, setEquipe] = useState<FuncRank[]>([]);
  const [servicos, setServicos] = useState<ServicoRank[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const p = { p_inicio: periodo.inicio, p_fim: periodo.fim };
    const [cp, ev, cl, fu, sv] = await Promise.all([
      sb.rpc("panorama_comparado", p),
      sb.rpc("evolucao_periodo", p),
      sb.rpc("ranking_clientes", { ...p, p_limite: 20 }),
      sb.rpc("ranking_funcionarios", p),
      sb.rpc("ranking_servicos", { ...p, p_limite: 15 }),
    ]);
    const falhou = cp.error ?? ev.error ?? cl.error ?? fu.error ?? sv.error;
    setErro(falhou ? mensagemErro(falhou) : null);
    setComp((cp.data as Comparado) ?? null);
    setEvolucao((ev.data as Evolucao[]) ?? []);
    setClientes((cl.data as ClienteRank[]) ?? []);
    setEquipe((fu.data as FuncRank[]) ?? []);
    setServicos((sv.data as ServicoRank[]) ?? []);
    setCarregando(false);
  }, [periodo]);

  useEffect(() => { void carregar(); }, [carregar]);

  function mudarAtalho(v: string) {
    setAtalho(v);
    if (v !== "livre") setPeriodo(atalhoPeriodo(v));
  }

  async function exportarPdf(aba: Window | null) {
    if (!comp) { aba?.close(); return; }
    setGerandoPdf(true);
    setErro(null);
    try {
      const { baixarPdfRelatorio } = await import("@/pdf/gerar");
      await baixarPdfRelatorio(
        { periodo, comp, evolucao, clientes, equipe, servicos }, false, aba);
    } catch (e) {
      aba?.close();
      setErro(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    }
    setGerandoPdf(false);
  }

  const a = comp?.atual;
  const b = comp?.anterior;
  const tetoRecebido = Math.max(1, ...evolucao.map((m) => Number(m.recebido)));
  const maiorProducao = Math.max(1, ...equipe.map((f) => Number(f.producao)));

  return (
    <>
      <TituloPagina
        titulo="Relatórios"
        descricao="Comparado sempre com o período anterior de mesmo tamanho."
        acao={
          <Botao type="button" variante="fantasma" disabled={gerandoPdf || carregando}
            onClick={() => void exportarPdf(reservarAba())}>
            <FileDown className="h-4 w-4" aria-hidden />
            {gerandoPdf ? "Gerando..." : "Exportar PDF"}
          </Botao>
        }
      />

      <div className="mb-4">
        <BarraPeriodo
          atalho={atalho} periodo={periodo}
          aoMudarAtalho={mudarAtalho}
          aoMudarData={(campo, valor) =>
            setPeriodo((p) => ({ ...p, [campo]: valor, rotulo: "Período escolhido" }))}
        />
      </div>

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <nav aria-label="Seções do relatório" className="mb-6 flex flex-wrap gap-2">
        {ABAS.map((x) => (
          <button key={x.chave} type="button" onClick={() => setAba(x.chave)}
            aria-current={aba === x.chave ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              aba === x.chave
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"}`}>
            {x.rotulo}
          </button>
        ))}
      </nav>

      {carregando ? (
        <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>
      ) : (
        <>
          {/* ================= visão geral ================= */}
          {aba === "geral" && a && b && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <IndicadorVariacao rotulo="Recebido" valor={brl(a.recebido)}
                  atual={Number(a.recebido)} anterior={Number(b.recebido)} />
                <IndicadorVariacao rotulo="Ordens entregues" valor={String(a.ordens)}
                  atual={Number(a.ordens)} anterior={Number(b.ordens)} />
                <IndicadorVariacao rotulo="Ticket médio" valor={brl(a.ticket)}
                  atual={Number(a.ticket)} anterior={Number(b.ticket)} />
                <IndicadorVariacao rotulo="Clientes atendidos" valor={String(a.clientes)}
                  atual={Number(a.clientes)} anterior={Number(b.clientes)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <IndicadorVariacao rotulo="Orçamentos emitidos" valor={String(a.orcamentos)}
                  atual={Number(a.orcamentos)} anterior={Number(b.orcamentos)} />
                <IndicadorVariacao rotulo="Taxa de conversão" valor={`${a.conversao}%`}
                  atual={Number(a.conversao)} anterior={Number(b.conversao)}
                  detalhe={`${a.convertidos} viraram OS`} />
                <IndicadorVariacao rotulo="Serviços executados" valor={String(a.itens)}
                  atual={Number(a.itens)} anterior={Number(b.itens)} />
              </div>

              <Cartao>
                <CabecalhoCartao titulo="Evolução mês a mês"
                  descricao="Recebido, ordens entregues e clientes novos." />
                {evolucao.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-carvao-500">
                    Sem movimento no período.
                  </p>
                ) : (
                  <div className="overflow-x-auto p-5">
                    <div className="flex min-w-[560px] items-end gap-3">
                      {evolucao.map((m) => (
                        <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold tabular-nums text-carvao-600">
                            {Math.round(Number(m.recebido) / 1000)}k
                          </span>
                          <div className="flex h-36 w-full items-end justify-center">
                            <div className="w-full rounded-t bg-marca-500"
                              style={{ height: `${(Number(m.recebido) / tetoRecebido) * 100}%` }}
                              title={`${brl(m.recebido)} · ${m.ordens} OS`} />
                          </div>
                          <span className="text-[11px] text-carvao-500">{mesCurto(m.mes)}</span>
                          <span className="text-[10px] text-carvao-400">{m.ordens} OS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Mês</Th>
                      <Th className="text-right">Recebido</Th>
                      <Th className="text-center">Ordens</Th>
                      <Th className="text-right">Ticket médio</Th>
                      <Th className="text-center">Clientes novos</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolucao.map((m) => (
                      <tr key={m.mes} className="hover:bg-carvao-50">
                        <Td className="font-medium text-carvao-950">{m.mes}</Td>
                        <Td className="text-right text-carvao-800">{brl(m.recebido)}</Td>
                        <Td className="text-center text-carvao-700">{m.ordens}</Td>
                        <Td className="text-right text-carvao-700">{brl(m.ticket)}</Td>
                        <Td className="text-center text-carvao-700">{m.novos}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </Cartao>
            </div>
          )}

          {/* ================= clientes ================= */}
          {aba === "clientes" && (
            <Cartao>
              <CabecalhoCartao titulo="Ranking de clientes"
                descricao="Por valor efetivamente pago no período." />
              <Tabela>
                <thead>
                  <tr>
                    <Th className="w-12">#</Th>
                    <Th>Cliente</Th>
                    <Th className="text-center">Visitas</Th>
                    <Th className="text-right">Ticket médio</Th>
                    <Th>Última visita</Th>
                    <Th className="text-right">Total pago</Th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.length === 0 && (
                    <LinhaVazia colunas={6} mensagem="Nenhum recebimento no período." />
                  )}
                  {clientes.map((c, i) => (
                    <tr key={c.id} className="hover:bg-carvao-50">
                      <Td>
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          MEDALHA[i] ?? "bg-carvao-100 text-carvao-500"}`}>
                          {i + 1}
                        </span>
                      </Td>
                      <Td>
                        <Link to={`/sistema/clientes/${c.id}`}
                          className="font-medium text-marca-600 hover:underline">
                          {c.nome}
                        </Link>
                        <p className="text-xs text-carvao-500">
                          {telefone(c.telefone)}{c.tipo === "JURIDICA" && " · frota"}
                        </p>
                      </Td>
                      <Td className="text-center text-carvao-700">{c.visitas}</Td>
                      <Td className="text-right text-carvao-700">{brl(c.ticket)}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="text-carvao-600">{data(c.ultima)}</span>
                        {Number(c.dias_sem_vir) > 90 && (
                          <Badge cor="bg-amber-100 text-amber-800" className="ml-2">
                            {c.dias_sem_vir}d sem vir
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right font-bold text-carvao-950">{brl(c.gasto)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <p className="border-t border-carvao-200 px-5 py-3 text-xs text-carvao-500">
                Quem está há mais de 90 dias sem aparecer é candidato a contato — o dado
                só vira ação se estiver visível na própria linha.
              </p>
            </Cartao>
          )}

          {/* ================= equipe ================= */}
          {aba === "equipe" && (
            <Cartao>
              <CabecalhoCartao titulo="Ranking da equipe"
                descricao="Produção e retrabalho por funcionário." />
              <Tabela>
                <thead>
                  <tr>
                    <Th className="w-12">#</Th>
                    <Th>Funcionário</Th>
                    <Th className="text-center">Serviços</Th>
                    <Th>Produção</Th>
                    <Th className="text-right">Comissão</Th>
                    <Th className="text-center">Retrabalho</Th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.length === 0 && (
                    <LinhaVazia colunas={6} mensagem="Sem produção no período." />
                  )}
                  {equipe.map((f, i) => (
                    <tr key={f.id} className="hover:bg-carvao-50">
                      <Td>
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          MEDALHA[i] ?? "bg-carvao-100 text-carvao-500"}`}>
                          {i + 1}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-medium text-carvao-950">{f.nome}</p>
                        <p className="text-xs text-carvao-500">{f.cargo}</p>
                      </Td>
                      <Td className="text-center text-carvao-700">{f.servicos}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="block h-1.5 w-24 rounded-full bg-carvao-100">
                            <span className="block h-1.5 rounded-full bg-marca-500"
                              style={{ width: `${(Number(f.producao) / maiorProducao) * 100}%` }} />
                          </span>
                          <span className="text-sm tabular-nums text-carvao-800">
                            {brl(f.producao)}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-right text-carvao-700">{brl(f.comissao)}</Td>
                      <Td className="text-center">
                        {f.conferidas > 0 ? (
                          <Badge cor={Number(f.pct_retrabalho) > 10
                            ? "bg-marca-100 text-marca-700"
                            : Number(f.pct_retrabalho) > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"}>
                            {f.pct_retrabalho}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-carvao-400">não medido</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <p className="border-t border-carvao-200 px-5 py-3 text-xs text-carvao-500">
                Retrabalho vem da conferência de limpeza: quantos serviços daquele
                funcionário voltaram para refazer. Produção alta com retrabalho alto não
                é produtividade, é pressa. Quem não faz serviço conferível aparece como
                "não medido".
              </p>
            </Cartao>
          )}

          {/* ================= serviços ================= */}
          {aba === "servicos" && (
            <Cartao>
              <CabecalhoCartao titulo="Serviços mais vendidos"
                descricao="Por faturamento no período." />
              <Tabela>
                <thead>
                  <tr>
                    <Th>Serviço</Th>
                    <Th>Categoria</Th>
                    <Th className="text-center">Vezes</Th>
                    <Th className="text-right">Preço médio</Th>
                    <Th className="text-right">Faturamento</Th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.length === 0 && (
                    <LinhaVazia colunas={5} mensagem="Nenhum serviço concluído no período." />
                  )}
                  {servicos.map((s) => (
                    <tr key={s.nome} className="hover:bg-carvao-50">
                      <Td className="font-medium text-carvao-950">{s.nome}</Td>
                      <Td>
                        <Badge cor="bg-carvao-100 text-carvao-700">{s.categoria}</Badge>
                      </Td>
                      <Td className="text-center text-carvao-700">{s.vezes}</Td>
                      <Td className="text-right text-carvao-600">{brl(s.preco_medio)}</Td>
                      <Td className="text-right font-bold text-carvao-950">
                        {brl(s.faturamento)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </Cartao>
          )}
        </>
      )}
    </>
  );
}
