import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Plus, Trash2, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, Indicador, LinhaVazia, Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { FORMA_PAGAMENTO, STATUS_LANCAMENTO } from "@/lib/constantes";
import { brl, data, fimDoMes, inicioDoMes, num, numeroDoc, somaDias } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { Demonstrativo } from "@/componentes/demonstrativo";
import { mensagemErro, sb } from "@/lib/supabase";
import type { CategoriaFinanceira, Lancamento, TipoLancamento } from "@/lib/tipos";
import { dinheiroParaNumero, mascararDinheiro } from "@/lib/mascaras";

type LancamentoNaTela = Lancamento & {
  categorias_financeiras: { nome: string } | null;
  ordens_servico: { id: string; numero: number } | null;
};

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Financeiro() {
  const [params, setParams] = useSearchParams();
  const mesParam = params.get("mes");
  const ref = mesParam && /^\d{4}-\d{2}$/.test(mesParam)
    ? new Date(Number(mesParam.slice(0, 4)), Number(mesParam.slice(5, 7)) - 1, 1)
    : new Date();

  const [linhas, setLinhas] = useState<LancamentoNaTela[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [totais, setTotais] = useState({ recebido: 0, pago: 0, aReceber: 0, aPagar: 0, atrasados: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [criando, setCriando] = useState(false);
  const [aba, setAba] = useState<"movimento" | "analise">("movimento");
  const [tipo, setTipo] = useState<TipoLancamento>("DESPESA");

  const carregar = useCallback(async () => {
    setCarregando(true);
    await sb.rpc("sincronizar_pendencias");

    const de = inicioDoMes(ref).toISOString();
    const ate = fimDoMes(ref).toISOString();

    const [l, c, pagos, pendentes] = await Promise.all([
      sb.from("lancamentos")
        .select("*, categorias_financeiras(nome), ordens_servico(id, numero)")
        .gte("vencimento", de).lte("vencimento", ate).order("vencimento"),
      sb.from("categorias_financeiras").select("*").eq("ativo", true).order("nome"),
      sb.from("lancamentos").select("tipo, valor")
        .eq("status", "PAGO").gte("pagamento", de).lte("pagamento", ate),
      sb.from("lancamentos").select("tipo, valor, status")
        .in("status", ["PENDENTE", "ATRASADO"]),
    ]);

    setErro(l.error ? mensagemErro(l.error) : null);
    setLinhas((l.data as LancamentoNaTela[]) ?? []);
    setCategorias((c.data as CategoriaFinanceira[]) ?? []);

    const somar = (arr: { tipo: string; valor: unknown }[] | null, t: string) =>
      (arr ?? []).filter((x) => x.tipo === t).reduce((s, x) => s + num(x.valor as never), 0);

    setTotais({
      recebido: somar(pagos.data as never, "RECEITA"),
      pago: somar(pagos.data as never, "DESPESA"),
      aReceber: somar(pendentes.data as never, "RECEITA"),
      aPagar: somar(pendentes.data as never, "DESPESA"),
      atrasados: ((pendentes.data as { status: string }[]) ?? [])
        .filter((x) => x.status === "ATRASADO").length,
    });
    setCarregando(false);
    // `ref` e recriado a cada render; a dependencia real e o mes escolhido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesParam]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function lancar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const valor = Number(f.get("valor")) || 0;
    const parcelas = Math.max(1, Number(f.get("parcelas")) || 1);
    const vencimento = new Date(`${String(f.get("vencimento"))}T12:00:00`);
    const jaPago = f.get("jaPago") === "on";
    const descricao = String(f.get("descricao") ?? "").trim();
    const forma = String(f.get("formaPagamento") ?? "");

    const { error } = await sb.from("lancamentos").insert(
      Array.from({ length: parcelas }, (_, i) => ({
        id: novoId(),
        tipo: String(f.get("tipo") ?? "DESPESA"),
        status: jaPago ? "PAGO" : "PENDENTE",
        descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
        valor: (valor / parcelas).toFixed(2),
        vencimento: somaDias(vencimento, i * 30).toISOString(),
        pagamento: jaPago ? agora() : null,
        forma: forma || null,
        categoriaId: String(f.get("categoriaId") ?? "") || null,
        fornecedor: String(f.get("fornecedor") ?? "").trim() || null,
        observacoes: String(f.get("observacoes") ?? "").trim() || null,
        parcela: parcelas > 1 ? i + 1 : null,
        totalParcelas: parcelas > 1 ? parcelas : null,
        atualizadoEm: agora(),
      })),
    );

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setCriando(false);
    await carregar();
  }

  async function baixar(l: LancamentoNaTela) {
    setOcupado(true);
    const voltando = l.status === "PAGO";
    await sb.from("lancamentos").update({
      status: voltando
        ? (new Date(l.vencimento) < new Date() ? "ATRASADO" : "PENDENTE")
        : "PAGO",
      pagamento: voltando ? null : agora(),
      atualizadoEm: agora(),
    }).eq("id", l.id);
    setOcupado(false);
    await carregar();
  }

  async function excluir(id: string) {
    setOcupado(true);
    await sb.from("lancamentos").delete().eq("id", id);
    setOcupado(false);
    await carregar();
  }

  const resultado = totais.recebido - totais.pago;
  const nomeMes = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const anterior = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const proximo = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

  // Despesas por categoria no periodo, para ler de onde sai o dinheiro
  const porCategoria = new Map<string, number>();
  for (const l of linhas) {
    if (l.tipo !== "DESPESA") continue;
    const nome = l.categorias_financeiras?.nome ?? "Sem categoria";
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + num(l.valor));
  }
  const ranking = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maior = ranking[0]?.[1] ?? 1;

  return (
    <>
      <TituloPagina
        titulo="Financeiro"
        descricao="Contas a pagar e a receber. As receitas de OS entram automaticamente na entrega."
        acao={
          <div className="flex items-center gap-1 rounded-md border border-carvao-300 bg-white">
            <button type="button" onClick={() => setParams({ mes: chaveMes(anterior) })}
              className="px-3 py-2 text-sm font-semibold text-carvao-600 hover:text-marca-600">←</button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize text-carvao-950">
              {nomeMes}
            </span>
            <button type="button" onClick={() => setParams({ mes: chaveMes(proximo) })}
              className="px-3 py-2 text-sm font-semibold text-carvao-600 hover:text-marca-600">→</button>
          </div>
        }
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <nav aria-label="Seções do financeiro" className="mb-6 flex flex-wrap gap-2">
        {([["movimento", "Movimento"], ["analise", "Demonstrativo"]] as const).map(
          ([chave, rotulo]) => (
            <button key={chave} type="button" onClick={() => setAba(chave)}
              aria-current={aba === chave ? "page" : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                aba === chave
                  ? "bg-carvao-950 text-white"
                  : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"}`}>
              {rotulo}
            </button>
          ),
        )}
      </nav>

      {aba === "analise" && <Demonstrativo />}

      {aba === "movimento" && (
      <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Recebido no mês" valor={brl(totais.recebido)}
          icone={<TrendingUp className="h-5 w-5" aria-hidden />} />
        <Indicador rotulo="Pago no mês" valor={brl(totais.pago)}
          icone={<TrendingDown className="h-5 w-5" aria-hidden />} />
        <Indicador rotulo="Resultado do mês" valor={brl(resultado)}
          detalhe={resultado >= 0 ? "Saldo positivo" : "Saldo negativo"}
          destaque={resultado < 0} icone={<Wallet className="h-5 w-5" aria-hidden />} />
        <Indicador rotulo="Em atraso" valor={String(totais.atrasados)}
          detalhe="Lançamentos vencidos" destaque={totais.atrasados > 0} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Indicador rotulo="A receber (total)" valor={brl(totais.aReceber)}
          detalhe="Pendentes e atrasados de todos os meses" />
        <Indicador rotulo="A pagar (total)" valor={brl(totais.aPagar)}
          detalhe="Pendentes e atrasados de todos os meses" />
      </div>

      {ranking.length > 0 && (
        <Cartao className="mt-6">
          <CabecalhoCartao titulo="Despesas por categoria" descricao={`No mês de ${nomeMes}`} />
          <ul className="space-y-3 p-5">
            {ranking.map(([nome, valor]) => (
              <li key={nome}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-carvao-700">{nome}</span>
                  <span className="font-semibold text-carvao-950">{brl(valor)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-carvao-100">
                  <div className="h-full rounded-full bg-marca-500"
                    style={{ width: `${(valor / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao className="mt-6">
        <CabecalhoCartao
          titulo="Novo lançamento"
          descricao="Receitas avulsas e despesas da oficina. As receitas de OS entram sozinhas na entrega."
          acao={
            <Botao type="button" variante={criando ? "fantasma" : "primario"}
              onClick={() => setCriando((v) => !v)}>
              {criando ? "Fechar" : <><Plus className="h-4 w-4" aria-hidden />Lançar</>}
            </Botao>
          } />
        {criando && (
          <form onSubmit={lancar} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Selecao rotulo="Tipo" name="tipo" value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoLancamento)}>
                <option value="DESPESA">Despesa</option>
                <option value="RECEITA">Receita</option>
              </Selecao>
              <Campo rotulo="Descrição" name="descricao" className="sm:col-span-3" required
                placeholder={tipo === "DESPESA"
                  ? "Compra de materiais, aluguel, energia..."
                  : "Venda de produto, serviço avulso..."} />
              <CampoMascara rotulo="Valor total (R$)" name="valor"
                mascara={mascararDinheiro} limpar={(v) => String(dinheiroParaNumero(v))}
                inputMode="decimal"
                min={0.01} required />
              <Campo rotulo="Vencimento" name="vencimento" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)} />
              <Campo rotulo="Parcelas" name="parcelas" type="number" min={1} max={36}
                defaultValue={1} dica="A cada 30 dias" />
              <Selecao rotulo="Categoria" name="categoriaId">
                <option value="">Sem categoria</option>
                {categorias.filter((c) => c.tipo === tipo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Selecao>
              <Selecao rotulo="Forma de pagamento" name="formaPagamento">
                <option value="">Não definida</option>
                {Object.entries(FORMA_PAGAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Selecao>
              <Campo rotulo={tipo === "DESPESA" ? "Fornecedor" : "Origem"}
                name="fornecedor" className="sm:col-span-2" />
              <label className="flex items-center gap-2 pb-1">
                <input type="checkbox" name="jaPago"
                  className="h-4 w-4 accent-[var(--color-marca-500)]" />
                <span className="text-sm text-carvao-800">Já foi pago</span>
              </label>
              <AreaTexto rotulo="Observações" name="observacoes" rows={2} className="sm:col-span-4" />
            </div>
            <Botao type="submit" disabled={ocupado}>Lançar</Botao>
          </form>
        )}
      </Cartao>

      <Cartao className="mt-6">
        <CabecalhoCartao titulo="Lançamentos"
          descricao={`${linhas.length} registro(s) no período`} />
        <Tabela>
          <thead>
            <tr>
              <Th>Vencimento</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th>Forma</Th>
              <Th>Status</Th>
              <Th className="text-right">Valor</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={7} mensagem="Carregando..." />}
            {!carregando && linhas.length === 0 && (
              <LinhaVazia colunas={7} mensagem="Nenhum lançamento no período." />
            )}
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-carvao-50">
                <Td className="whitespace-nowrap text-carvao-600">
                  {data(l.vencimento)}
                  {l.pagamento && (
                    <span className="block text-xs text-emerald-700">pago {data(l.pagamento)}</span>
                  )}
                </Td>
                <Td>
                  <p className="font-medium text-carvao-950">{l.descricao}</p>
                  <p className="text-xs text-carvao-500">
                    {l.fornecedor && `${l.fornecedor} · `}
                    {l.ordens_servico && (
                      <Link to={`/sistema/ordens/${l.ordens_servico.id}`}
                        className="font-semibold text-marca-600 hover:underline">
                        OS {numeroDoc(l.ordens_servico.numero)}
                      </Link>
                    )}
                  </p>
                </Td>
                <Td className="text-carvao-600">{l.categorias_financeiras?.nome ?? "—"}</Td>
                <Td className="text-carvao-600">{l.forma ? FORMA_PAGAMENTO[l.forma] : "—"}</Td>
                <Td>
                  <Badge cor={STATUS_LANCAMENTO[l.status].cor}>
                    {STATUS_LANCAMENTO[l.status].label}
                  </Badge>
                </Td>
                <Td className={`whitespace-nowrap text-right font-bold ${
                  l.tipo === "RECEITA" ? "text-emerald-700" : "text-marca-700"}`}>
                  {l.tipo === "RECEITA" ? "+" : "−"} {brl(l.valor)}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => void baixar(l)} disabled={ocupado}
                      title={l.status === "PAGO" ? "Desfazer baixa" : "Dar baixa"}
                      className={`rounded p-1.5 transition ${
                        l.status === "PAGO"
                          ? "text-carvao-400 hover:bg-carvao-100 hover:text-carvao-700"
                          : "text-emerald-600 hover:bg-emerald-50"}`}>
                      {l.status === "PAGO"
                        ? <Undo2 className="h-4 w-4" aria-hidden />
                        : <Check className="h-4 w-4" aria-hidden />}
                      <span className="sr-only">
                        {l.status === "PAGO" ? "Desfazer baixa" : "Dar baixa"} em {l.descricao}
                      </span>
                    </button>
                    <button type="button" onClick={() => void excluir(l.id)} disabled={ocupado}
                      className="rounded p-1.5 text-carvao-400 transition hover:bg-marca-50 hover:text-marca-600"
                      aria-label={`Excluir ${l.descricao}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
      </>
      )}
    </>
  );
}
