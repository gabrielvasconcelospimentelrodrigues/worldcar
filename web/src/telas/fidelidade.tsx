import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Save, Star } from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Campo, Cartao, Indicador, LinhaVazia,
  Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { NIVEL_FIDELIDADE } from "@/lib/constantes";
import { brl, data } from "@/lib/format";
import { useSessao } from "@/lib/sessao-contexto";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Programa de fidelidade: regras e acompanhamento.
 *
 * O numero que manda aqui e o PASSIVO — pontos em circulacao vezes o valor do
 * ponto. E desconto ja prometido que vai sair do caixa em algum mes futuro.
 * Programa de pontos sem essa conta a vista e uma divida que ninguem mediu, e a
 * hora de descobrir nao pode ser quando trinta clientes resgatam no mesmo mes.
 */

type Painel = {
  ativo: boolean;
  participantes: number;
  pontos_ativos: number;
  passivo: number;
  pontos_concedidos_mes: number;
  pontos_resgatados_mes: number;
  valor_resgatado_mes: number;
  vencendo_60d: number;
  clientes_vencendo: number;
  por_nivel: { nivel: string; clientes: number; pontos: number; gasto: number }[];
};

type Parametros = {
  ativo: boolean;
  pontosPorReal: string;
  valorDoPonto: string;
  validadeMeses: number;
  minimoResgate: number;
};

type Membro = {
  clienteId: string; nome: string; pontos: number; nivel: string;
  gasto12m: string; visitas12m: number;
};

type Resgate = {
  id: string; clienteId: string; pontos: number; valorBase: string | null;
  criadoEm: string; clientes: { nome: string } | null;
};

const NIVEIS = NIVEL_FIDELIDADE;

export function ProgramaFidelidade() {
  const { perfil } = useSessao();
  const ehAdmin = perfil?.papel === "ADMIN";

  const [painel, setPainel] = useState<Painel | null>(null);
  const [par, setPar] = useState<Parametros | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [resgates, setResgates] = useState<Resgate[]>([]);
  const [filtro, setFiltro] = useState("");
  const [soResgataveis, setSoResgataveis] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = sb.from("fidelidade_saldo").select("*")
      .order("pontos", { ascending: false }).limit(50);
    if (filtro) q = q.eq("nivel", filtro);
    // Nao virou alerta de propósito: avisar sobre todo cliente com saldo gerava
    // centenas de linhas no mesmo dia e tornava a tela de alertas ilegivel.
    // Isso e campanha — trabalha-se a lista aqui, com calma.
    if (soResgataveis) q = q.gte("pontos", par?.minimoResgate ?? 200);

    const [pa, pr, me, re] = await Promise.all([
      sb.rpc("painel_fidelidade"),
      sb.from("parametros_fidelidade").select("*").eq("id", "default").maybeSingle(),
      q,
      sb.from("fidelidade_movimentos")
        .select("*, clientes(nome)").eq("tipo", "RESGATE")
        .order("criadoEm", { ascending: false }).limit(15),
    ]);
    const falhou = pa.error ?? pr.error ?? me.error ?? re.error;
    setErro(falhou ? mensagemErro(falhou) : null);
    setPainel((pa.data as Painel) ?? null);
    setPar((pr.data as Parametros) ?? null);
    setMembros((me.data as Membro[]) ?? []);
    setResgates((re.data as unknown as Resgate[]) ?? []);
    setCarregando(false);
  }, [filtro, soResgataveis, par?.minimoResgate]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvarRegras(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true); setErro(null); setOk(null);
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from("parametros_fidelidade").update({
      ativo: f.get("ativo") === "on",
      pontosPorReal: (Number(f.get("pontosPorReal")) || 0).toFixed(2),
      // A tela pede "quantos reais valem 100 pontos", que e como se pensa o
      // beneficio; o banco guarda o valor unitario.
      valorDoPonto: ((Number(f.get("valorPor100")) || 0) / 100).toFixed(4),
      validadeMeses: Number(f.get("validadeMeses")) || 12,
      minimoResgate: Number(f.get("minimoResgate")) || 0,
      atualizadoEm: new Date().toISOString(),
    }).eq("id", "default");
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setOk("Regras atualizadas. Valem para os próximos pagamentos.");
    await carregar();
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <>
      <TituloPagina
        titulo="Programa de fidelidade"
        descricao="Pontos acumulados, níveis e o quanto isso representa de desconto prometido."
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      {painel && !painel.ativo && (
        <div className="mb-4">
          <Aviso tipo="erro">
            O programa está desativado: nenhum ponto novo é creditado. O saldo já
            acumulado continua válido e pode ser resgatado.
          </Aviso>
        </div>
      )}

      {painel && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador rotulo="Clientes com pontos" valor={String(painel.participantes)} />
            <Indicador rotulo="Pontos em circulação"
              valor={Number(painel.pontos_ativos).toLocaleString("pt-BR")}
              icone={<Star className="h-5 w-5" aria-hidden />} />
            <Indicador rotulo="Desconto prometido" valor={brl(painel.passivo)}
              detalhe="Se todos resgatassem hoje" destaque />
            <Indicador rotulo="Resgatado no mês" valor={brl(painel.valor_resgatado_mes)}
              detalhe={`${painel.pontos_resgatados_mes} pontos`} />
          </div>

          {Number(painel.vencendo_60d) > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">
                  {Number(painel.vencendo_60d).toLocaleString("pt-BR")} pontos vencem
                  nos próximos 60 dias, de {painel.clientes_vencendo} cliente(s).
                </p>
                <p className="text-amber-800">
                  É o melhor motivo para chamar essas pessoas de volta antes de o
                  benefício virar pó.
                </p>
              </div>
            </div>
          )}

          <Cartao className="mt-6">
            <CabecalhoCartao titulo="Distribuição por nível"
              descricao="O nível vem do gasto dos últimos 12 meses, não do saldo de pontos." />
            <Tabela>
              <thead>
                <tr>
                  <Th>Nível</Th>
                  <Th>A partir de</Th>
                  <Th className="text-center">Clientes</Th>
                  <Th className="text-right">Pontos</Th>
                  <Th className="text-right">Gasto em 12 meses</Th>
                </tr>
              </thead>
              <tbody>
                {painel.por_nivel.map((n) => (
                  <tr key={n.nivel} className="hover:bg-carvao-50">
                    <Td>
                      <Badge cor={NIVEIS[n.nivel]?.cor ?? ""}>
                        {NIVEIS[n.nivel]?.rotulo ?? n.nivel}
                      </Badge>
                    </Td>
                    <Td className="text-carvao-500">{NIVEIS[n.nivel]?.minimo}</Td>
                    <Td className="text-center font-semibold text-carvao-950">
                      {n.clientes}
                    </Td>
                    <Td className="text-right text-carvao-700">
                      {Number(n.pontos).toLocaleString("pt-BR")}
                    </Td>
                    <Td className="text-right text-carvao-700">{brl(n.gasto)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </>
      )}

      {/* ---------------- regras ---------------- */}
      {par && (
        <Cartao className="mt-6">
          <CabecalhoCartao titulo="Regras do programa"
            descricao={ehAdmin
              ? "Valem para os pagamentos daqui em diante; o saldo já acumulado não muda."
              : "Somente o administrador altera estas regras."} />
          <form onSubmit={salvarRegras} className="space-y-4 p-5">
            <label className="flex items-start gap-2.5">
              <input type="checkbox" name="ativo" defaultChecked={par.ativo}
                disabled={!ehAdmin}
                className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]" />
              <span className="text-sm">
                <span className="block font-semibold text-carvao-950">
                  Programa ativo
                </span>
                <span className="block text-xs text-carvao-500">
                  Desativar para de creditar pontos novos, mas não apaga o que já existe.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo rotulo="Pontos por R$ 1,00" name="pontosPorReal"
                type="number" step="0.01" min={0} disabled={!ehAdmin}
                defaultValue={par.pontosPorReal}
                dica="1,00 = um ponto por real pago" />
              <Campo rotulo="R$ por 100 pontos" name="valorPor100"
                type="number" step="0.01" min={0} disabled={!ehAdmin}
                defaultValue={(Number(par.valorDoPonto) * 100).toFixed(2)}
                dica="Quanto o cliente ganha de desconto" />
              <Campo rotulo="Validade (meses)" name="validadeMeses"
                type="number" min={1} max={60} disabled={!ehAdmin}
                defaultValue={par.validadeMeses}
                dica="Ponto vence e sai do saldo" />
              <Campo rotulo="Resgate mínimo (pontos)" name="minimoResgate"
                type="number" min={0} disabled={!ehAdmin}
                defaultValue={par.minimoResgate} />
            </div>

            <p className="rounded-md bg-carvao-50 p-3 text-xs text-carvao-600">
              Com as regras atuais, um serviço de R$ 500 gera{" "}
              <strong>{Math.floor(500 * Number(par.pontosPorReal))} pontos</strong>, que
              valem <strong>{brl(Math.floor(500 * Number(par.pontosPorReal)) * Number(par.valorDoPonto))}</strong>{" "}
              de desconto — o equivalente a{" "}
              {(Number(par.pontosPorReal) * Number(par.valorDoPonto) * 100).toFixed(1)}% de
              retorno para o cliente.
            </p>

            {ehAdmin && (
              <div className="flex justify-end">
                <Botao type="submit" disabled={salvando}>
                  <Save className="h-4 w-4" aria-hidden />
                  {salvando ? "Salvando..." : "Salvar regras"}
                </Botao>
              </div>
            )}
          </form>
        </Cartao>
      )}

      {/* ---------------- membros ---------------- */}
      <Cartao className="mt-6">
        <CabecalhoCartao titulo="Clientes no programa"
          descricao="Ordenados por saldo de pontos."
          acao={
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 pb-2 text-sm text-carvao-700">
                <input type="checkbox" checked={soResgataveis}
                  onChange={(e) => setSoResgataveis(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-marca-500)]" />
                Só quem já pode resgatar
              </label>
              <Selecao rotulo="Nível" value={filtro} className="w-40"
                onChange={(e) => setFiltro(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(NIVEIS).map(([k, v]) => (
                  <option key={k} value={k}>{v.rotulo}</option>
                ))}
              </Selecao>
            </div>
          } />
        <Tabela>
          <thead>
            <tr>
              <Th className="w-12">#</Th>
              <Th>Cliente</Th>
              <Th>Nível</Th>
              <Th className="text-center">Visitas 12m</Th>
              <Th className="text-right">Gasto 12m</Th>
              <Th className="text-right">Pontos</Th>
            </tr>
          </thead>
          <tbody>
            {membros.length === 0 && (
              <LinhaVazia colunas={6} mensagem="Nenhum cliente neste filtro." />
            )}
            {membros.map((m, i) => (
              <tr key={m.clienteId} className="hover:bg-carvao-50">
                <Td className="text-carvao-400">{i + 1}</Td>
                <Td>
                  <Link to={`/sistema/clientes/${m.clienteId}`}
                    className="font-medium text-marca-600 hover:underline">
                    {m.nome}
                  </Link>
                </Td>
                <Td>
                  <Badge cor={NIVEIS[m.nivel]?.cor ?? ""}>
                    {NIVEIS[m.nivel]?.rotulo ?? m.nivel}
                  </Badge>
                </Td>
                <Td className="text-center text-carvao-700">{m.visitas12m}</Td>
                <Td className="text-right text-carvao-700">{brl(m.gasto12m)}</Td>
                <Td className="text-right">
                  <p className="font-bold text-carvao-950">
                    {Number(m.pontos).toLocaleString("pt-BR")}
                  </p>
                  {par && Number(m.pontos) > 0 && (
                    <p className="text-xs text-emerald-700">
                      {brl(Number(m.pontos) * Number(par.valorDoPonto))} em desconto
                    </p>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>

      {/* ---------------- resgates ---------------- */}
      <Cartao className="mt-6">
        <CabecalhoCartao titulo="Últimos resgates"
          descricao="Pontos trocados por desconto." />
        <Tabela>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Data</Th>
              <Th className="text-right">Pontos</Th>
              <Th className="text-right">Desconto</Th>
            </tr>
          </thead>
          <tbody>
            {resgates.length === 0 && (
              <LinhaVazia colunas={4} mensagem="Nenhum resgate até agora." />
            )}
            {resgates.map((r) => (
              <tr key={r.id} className="hover:bg-carvao-50">
                <Td>
                  <Link to={`/sistema/clientes/${r.clienteId}`}
                    className="font-medium text-marca-600 hover:underline">
                    {r.clientes?.nome ?? "—"}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-carvao-600">{data(r.criadoEm)}</Td>
                <Td className="text-right text-marca-600">{r.pontos}</Td>
                <Td className="text-right font-semibold text-carvao-950">
                  {brl(r.valorBase ?? 0)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
