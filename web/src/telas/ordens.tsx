import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Aviso, Badge, BotaoLink, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { STATUS_OS } from "@/lib/constantes";
import { brl, data, numeroDoc } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import { useEquipe } from "@/lib/equipe";
import type { OrdemServico, StatusOS } from "@/lib/tipos";

type OrdemNaLista = OrdemServico & {
  clientes: { nome: string } | null;
  veiculos: { marca: string; modelo: string; placa: string } | null;
  itens: { status: string }[];
};

type SituacaoPagamento = {
  ordemId: string;
  total: string;
  pago: string;
  falta: string;
  vencidas: number;
  situacao: "QUITADA" | "PARCIAL" | "A_RECEBER" | "ATRASADA" | "SEM_COBRANCA" | "NAO_LANCADO";
};

/**
 * O total da OS e o que foi COBRADO; nao diz nada sobre o que entrou. Duas
 * ordens de R$ 2.000 pareciam iguais na lista: uma quitada no PIX e outra com
 * R$ 1.400 a receber — e e justamente isso que decide se alguem precisa ligar
 * para o cliente.
 */
const PAGAMENTO: Record<SituacaoPagamento["situacao"], { label: string; cor: string }> = {
  QUITADA:      { label: "Pago",         cor: "bg-emerald-100 text-emerald-800" },
  PARCIAL:      { label: "Parcial",      cor: "bg-amber-100 text-amber-800" },
  A_RECEBER:    { label: "A receber",    cor: "bg-sky-100 text-sky-800" },
  ATRASADA:     { label: "Em atraso",    cor: "bg-marca-100 text-marca-700" },
  SEM_COBRANCA: { label: "Sem cobrança", cor: "bg-carvao-100 text-carvao-600" },
  NAO_LANCADO:  { label: "Não lançado",  cor: "bg-carvao-200 text-carvao-700" },
};

const FILTROS = [
  { valor: "ATIVAS", rotulo: "Na oficina" },
  { valor: "A_RECEBER", rotulo: "A receber" },
  { valor: "TODAS", rotulo: "Todas" },
  { valor: "AGUARDANDO", rotulo: "Aguardando" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "PRONTA", rotulo: "Prontas" },
  { valor: "ENTREGUE", rotulo: "Entregues" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
];

const EM_ABERTO: StatusOS[] = ["AGUARDANDO", "EM_ANDAMENTO", "PAUSADA", "PRONTA"];

export function Ordens() {
  const [params, setParams] = useSearchParams();
  const filtro = params.get("status") ?? "ATIVAS";
  const [linhas, setLinhas] = useState<OrdemNaLista[]>([]);
  const [pagamentos, setPagamentos] = useState<Map<string, SituacaoPagamento>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const { nome: nomeFuncionario } = useEquipe();

  useEffect(() => {
    let vivo = true;

    (async () => {
      setCarregando(true);
      // Cliente e veiculo vem embutidos; os nomes dos funcionarios saem do
      // cache da visao `equipe` (ver lib/equipe.ts — a RLS de `funcionarios`
      // nao deixa o tecnico ler a ficha dos colegas).
      let q = sb
        .from("ordens_servico")
        .select("*, clientes(nome), veiculos(marca, modelo, placa), itens:os_itens(status)")
        .order("dataEntrada", { ascending: false })
        .limit(100);

      if (filtro === "ATIVAS") q = q.in("status", EM_ABERTO);
      else if (filtro === "A_RECEBER") {
        // O filtro parte dos recebimentos em aberto, nao do status da OS: quem
        // deve pode ter retirado o carro ha meses.
        const { data: devendo } = await sb.from("situacao_pagamento_os")
          .select("ordemId").in("situacao", ["PARCIAL", "A_RECEBER", "ATRASADA"])
          .limit(100);
        const ids = (devendo ?? []).map((x) => (x as { ordemId: string }).ordemId);
        if (ids.length === 0) {
          if (!vivo) return;
          setLinhas([]); setPagamentos(new Map()); setErro(null); setCarregando(false);
          return;
        }
        q = q.in("id", ids);
      } else if (filtro !== "TODAS") q = q.eq("status", filtro as StatusOS);

      const { data: d, error } = await q;
      if (!vivo) return;
      setErro(error ? mensagemErro(error) : null);
      const ordens = (d as OrdemNaLista[]) ?? [];
      setLinhas(ordens);

      // Consulta separada em vez de embutir: somar recebimento por OS do lado
      // do navegador exigiria baixar todos os lancamentos de cem ordens so para
      // reduzi-los a um rotulo.
      if (ordens.length > 0) {
        const { data: sit } = await sb.from("situacao_pagamento_os")
          .select("*").in("ordemId", ordens.map((o) => o.id));
        if (!vivo) return;
        setPagamentos(new Map(
          ((sit as SituacaoPagamento[]) ?? []).map((x) => [x.ordemId, x]),
        ));
      } else {
        setPagamentos(new Map());
      }
      setCarregando(false);
    })();

    return () => { vivo = false; };
  }, [filtro]);

  const agora = new Date();

  return (
    <>
      <TituloPagina
        titulo="Ordens de serviço"
        descricao="Entrada, execução e saída — cada etapa com o funcionário responsável."
        acao={
          <BotaoLink to="/sistema/ordens/nova">
            <Plus className="h-4 w-4" aria-hidden />
            Entrada de veículo
          </BotaoLink>
        }
      />

      <nav aria-label="Filtrar ordens" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setParams({ status: f.valor })}
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
              filtro === f.valor
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </nav>

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>OS</Th>
              <Th>Cliente / veículo</Th>
              <Th>Entrada</Th>
              <Th>Saída</Th>
              <Th className="text-center">Progresso</Th>
              <Th>Status</Th>
              <Th>Pagamento</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={8} mensagem="Carregando..." />}
            {!carregando && linhas.length === 0 && (
              <LinhaVazia colunas={8} mensagem="Nenhuma ordem de serviço neste filtro." />
            )}
            {linhas.map((o) => {
              const total = o.itens?.length ?? 0;
              const feitos = (o.itens ?? []).filter(
                (i) => i.status === "CONCLUIDO" || i.status === "CANCELADO",
              ).length;
              const pgto = pagamentos.get(o.id);
              const rotuloPgto = pgto ? PAGAMENTO[pgto.situacao] : null;
              const atrasada =
                o.previsaoEntrega &&
                new Date(o.previsaoEntrega) < agora &&
                !["ENTREGUE", "CANCELADA"].includes(o.status);

              return (
                <tr key={o.id} className="hover:bg-carvao-50">
                  <Td>
                    <Link to={`/sistema/ordens/${o.id}`}
                      className="font-semibold text-marca-600 hover:underline">
                      {numeroDoc(o.numero)}
                    </Link>
                    {atrasada && (
                      <Badge cor="bg-marca-600 text-white" className="mt-1 block w-fit">
                        Atrasada
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">{o.clientes?.nome ?? "—"}</p>
                    <p className="text-xs text-carvao-500">
                      {o.veiculos?.marca} {o.veiculos?.modelo} · {o.veiculos?.placa}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-carvao-700">{data(o.dataEntrada)}</p>
                    <p className="text-xs text-carvao-500">
                      {nomeFuncionario(o.funcionarioEntradaId).split(" ")[0]}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {o.dataSaida ? (
                      <>
                        <p className="text-carvao-700">{data(o.dataSaida)}</p>
                        <p className="text-xs text-carvao-500">
                          {nomeFuncionario(o.funcionarioSaidaId).split(" ")[0]}
                        </p>
                      </>
                    ) : (
                      <span className="text-carvao-400">—</span>
                    )}
                  </Td>
                  <Td className="text-center">
                    <span className="text-xs font-semibold text-carvao-700">
                      {feitos}/{total}
                    </span>
                    <div
                      className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-carvao-200"
                      role="img"
                      aria-label={`${feitos} de ${total} serviços concluídos`}
                    >
                      <div className="h-full bg-marca-500"
                        style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} />
                    </div>
                  </Td>
                  <Td>
                    <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
                  </Td>
                  <Td>
                    {rotuloPgto ? (
                      <>
                        <Badge cor={rotuloPgto.cor}>{rotuloPgto.label}</Badge>
                        {/* O quanto falta so aparece quando falta: repetir o
                            valor cheio em toda linha quitada viraria ruido. */}
                        {pgto && Number(pgto.falta) > 0.005 && (
                          <p className="mt-1 text-xs text-carvao-500">
                            falta {brl(pgto.falta)}
                            {pgto.vencidas > 0 && (
                              <span className="font-semibold text-marca-600">
                                {" "}· {pgto.vencidas} vencida(s)
                              </span>
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-carvao-300">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-bold text-carvao-950">
                    {brl(o.total)}
                    {pgto && Number(pgto.pago) > 0.005 && Number(pgto.falta) > 0.005 && (
                      <p className="text-xs font-normal text-emerald-700">
                        pago {brl(pgto.pago)}
                      </p>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
