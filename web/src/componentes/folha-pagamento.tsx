import { useCallback, useEffect, useState } from "react";
import { Calculator, Lock, RefreshCw } from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Cartao, Indicador, LinhaVazia,
  Selecao, Tabela, Td, Th,
} from "@/componentes/ui";
import { brl, num } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Folha de pagamento do mes.
 *
 * O que esta tela responde: quanto a equipe custa, e de onde vem esse custo.
 * Salario e so uma parte — comissao e encargo costumam somar tanto quanto, e
 * era justamente isso que nao aparecia em lugar nenhum do sistema.
 *
 * Nao e folha fiscal. Nao emite guia nem holerite legal; serve para decidir,
 * nao para recolher. Quem recolhe e a contabilidade.
 */

type ItemFolha = {
  id: string;
  funcionarioId: string;
  salarioBase: string;
  comissoes: string;
  adicionais: string;
  descontoFaltas: string;
  outrosDescontos: string;
  liquido: string;
  encargos: string;
  custoTotal: string;
  faltas: number;
  funcionarios: { nome: string; cargo: string } | null;
};

type Folha = {
  id: string;
  competencia: string;
  status: "ABERTA" | "FECHADA" | "CANCELADA";
  totalProventos: string;
  totalDescontos: string;
  totalLiquido: string;
  totalEncargos: string;
  custoTotal: string;
  fechadaEm: string | null;
};

/** Ultimos 12 meses, do mais recente para o mais antigo. */
function competenciasRecentes() {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const mesPorExtenso = (c: string) => {
  const [ano, mes] = c.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export function FolhaPagamento() {
  const COMPETENCIAS = competenciasRecentes();
  const [competencia, setCompetencia] = useState(COMPETENCIAS[0]);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [itens, setItens] = useState<ItemFolha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: f } = await sb.from("folhas").select("*")
      .eq("competencia", competencia).maybeSingle();
    const atual = (f as Folha | null) ?? null;
    setFolha(atual);

    if (atual) {
      const { data: its } = await sb.from("folha_itens")
        .select("*, funcionarios(nome, cargo)")
        .eq("folhaId", atual.id)
        .order("custoTotal", { ascending: false });
      setItens((its as unknown as ItemFolha[]) ?? []);
    } else {
      setItens([]);
    }
    setCarregando(false);
  }, [competencia]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function gerar() {
    setOcupado(true); setErro(null); setOk(null);
    const { error } = await sb.rpc("gerar_folha", { p_competencia: competencia });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setOk(`Folha de ${mesPorExtenso(competencia)} calculada.`);
    await carregar();
  }

  async function fechar() {
    setOcupado(true); setErro(null); setOk(null);
    const { data: r, error } = await sb.rpc("fechar_folha", { p_folha_id: folha?.id });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const res = r as { comissoes_quitadas: number; vencimento: string };
    setOk(
      `Folha fechada. Duas despesas lançadas no financeiro e ${res.comissoes_quitadas} ` +
      "comissão(ões) marcadas como pagas.",
    );
    await carregar();
  }

  const fechada = folha?.status === "FECHADA";
  const custo = num(folha?.custoTotal ?? 0);
  const liquido = num(folha?.totalLiquido ?? 0);
  const encargos = num(folha?.totalEncargos ?? 0);
  const comissoes = itens.reduce((s, i) => s + num(i.comissoes), 0);

  return (
    <div className="space-y-6">
      <Cartao>
        <CabecalhoCartao
          titulo="Folha de pagamento"
          descricao="Custo da equipe no mês: salários, comissões e encargos."
          acao={
            <div className="flex flex-wrap items-end gap-2">
              <Selecao rotulo="Competência" value={competencia} className="w-48"
                onChange={(e) => setCompetencia(e.target.value)}>
                {COMPETENCIAS.map((c) => (
                  <option key={c} value={c}>{mesPorExtenso(c)}</option>
                ))}
              </Selecao>
              <div className="pb-0.5">
                <Botao type="button" variante="fantasma" disabled={ocupado || fechada}
                  onClick={() => void gerar()} className="px-3 py-1.5 text-xs">
                  {folha ? <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    : <Calculator className="h-3.5 w-3.5" aria-hidden />}
                  {folha ? "Recalcular" : "Calcular folha"}
                </Botao>
              </div>
            </div>
          }
        />

        {erro && <div className="px-5 pt-4"><Aviso tipo="erro">{erro}</Aviso></div>}
        {ok && <div className="px-5 pt-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

        {carregando ? (
          <p className="px-5 py-8 text-center text-sm text-carvao-500">Carregando...</p>
        ) : !folha ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-carvao-950">
              A folha de {mesPorExtenso(competencia)} ainda não foi calculada.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-carvao-500">
              O cálculo usa os funcionários ativos, as comissões do mês e as faltas
              registradas em ocorrências.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 border-b border-carvao-200 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Indicador rotulo="Líquido a pagar" valor={brl(liquido)}
                detalhe="Salários + comissões − descontos" />
              <Indicador rotulo="Comissões" valor={brl(comissoes)}
                detalhe="Já incluídas no líquido" />
              <Indicador rotulo="Encargos" valor={brl(encargos)}
                detalhe="FGTS e provisões de 13º e férias" />
              <Indicador rotulo="Custo total da equipe" valor={brl(custo)} destaque />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-carvao-200 bg-carvao-50 px-5 py-3">
              <Badge cor={fechada
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"}>
                {fechada ? "Fechada" : "Aberta"}
              </Badge>
              {fechada ? (
                <p className="text-xs text-carvao-500">
                  Já lançada no financeiro. Para corrigir, ajuste os lançamentos por lá.
                </p>
              ) : (
                <Botao type="button" disabled={ocupado} onClick={() => void fechar()}
                  className="px-4 py-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Fechar e lançar no financeiro
                </Botao>
              )}
            </div>

            <Tabela>
              <thead>
                <tr>
                  <Th>Funcionário</Th>
                  <Th className="text-right">Salário</Th>
                  <Th className="text-right">Comissões</Th>
                  <Th className="text-right">Descontos</Th>
                  <Th className="text-right">Líquido</Th>
                  <Th className="text-right">Encargos</Th>
                  <Th className="text-right">Custo</Th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <LinhaVazia colunas={7} mensagem="Nenhum funcionário nesta folha." />
                )}
                {itens.map((i) => {
                  const descontos = num(i.descontoFaltas) + num(i.outrosDescontos);
                  return (
                    <tr key={i.id} className="hover:bg-carvao-50">
                      <Td>
                        <p className="font-medium text-carvao-950">
                          {i.funcionarios?.nome ?? "—"}
                        </p>
                        <p className="text-xs text-carvao-500">
                          {i.funcionarios?.cargo}
                          {i.faltas > 0 && ` · ${i.faltas} falta(s)`}
                        </p>
                      </Td>
                      <Td className="text-right text-carvao-700">{brl(i.salarioBase)}</Td>
                      <Td className="text-right text-carvao-700">
                        {num(i.comissoes) > 0 ? brl(i.comissoes) : "—"}
                      </Td>
                      <Td className="text-right text-marca-600">
                        {descontos > 0 ? `− ${brl(descontos)}` : "—"}
                      </Td>
                      <Td className="text-right font-semibold text-carvao-950">
                        {brl(i.liquido)}
                      </Td>
                      <Td className="text-right text-carvao-500">{brl(i.encargos)}</Td>
                      <Td className="text-right font-bold text-carvao-950">
                        {brl(i.custoTotal)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>

            <p className="border-t border-carvao-200 px-5 py-3 text-xs text-carvao-500">
              Encargos calculados por percentual configurável (FGTS e provisões de 13º e
              férias). Este é o custo gerencial da equipe — não substitui o cálculo da
              contabilidade nem gera guias.
            </p>
          </>
        )}
      </Cartao>
    </div>
  );
}
