import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, FileText, Plus, Trash2, TrendingDown, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, Campo, Cartao, CabecalhoCartao,
  Dado, Selecao, TituloPagina,
} from "@/componentes/ui";
import { STATUS_COTACAO, UNIDADES } from "@/lib/constantes";
import { brl, data, num, numeroDoc } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { montarComparativo } from "@/lib/comparativo";
import { useEquipe } from "@/lib/equipe";
import { mensagemErro, sb } from "@/lib/supabase";
import type {
  Cotacao, CotacaoFornecedor, CotacaoItem, CotacaoPreco, Fornecedor, OrdemServico,
} from "@/lib/tipos";
import { reservarAba } from "@/pdf/aba";

export function FichaCotacao() {
  const { id } = useParams<{ id: string }>();
  const { nome: nomeFuncionario } = useEquipe();

  const [cot, setCot] = useState<Cotacao | null>(null);
  const [itens, setItens] = useState<CotacaoItem[]>([]);
  const [cfs, setCfs] = useState<CotacaoFornecedor[]>([]);
  const [precos, setPrecos] = useState<CotacaoPreco[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [addItem, setAddItem] = useState(false);
  const [addForn, setAddForn] = useState(false);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [c, i, cf, fs] = await Promise.all([
      sb.from("cotacoes").select("*").eq("id", id).maybeSingle(),
      sb.from("cotacao_itens").select("*").eq("cotacaoId", id).order("ordem"),
      sb.from("cotacao_fornecedores").select("*").eq("cotacaoId", id),
      sb.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    ]);

    const cc = c.data as Cotacao | null;
    setCot(cc);
    setItens((i.data as CotacaoItem[]) ?? []);
    const listaCf = (cf.data as CotacaoFornecedor[]) ?? [];
    setCfs(listaCf);
    setFornecedores((fs.data as Fornecedor[]) ?? []);

    if (listaCf.length > 0) {
      const { data: p } = await sb.from("cotacao_precos").select("*")
        .in("cotacaoFornecedorId", listaCf.map((x) => x.id));
      setPrecos((p as CotacaoPreco[]) ?? []);
    } else {
      setPrecos([]);
    }

    if (cc?.ordemId) {
      const { data: o } = await sb.from("ordens_servico").select("*")
        .eq("id", cc.ordemId).maybeSingle();
      setOrdem(o as OrdemServico);
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const comparativo = useMemo(
    () => montarComparativo(itens, cfs, precos, fornecedores),
    [itens, cfs, precos, fornecedores],
  );

  const editavel = cot ? !["DECIDIDA", "CANCELADA"].includes(cot.status) : false;

  /**
   * Grava o preço de um fornecedor para um item, criando a célula se não existir.
   *
   * A existência é consultada no banco, não no estado do React: quem preenche a
   * matriz pula de célula em célula mais rápido do que o recarregamento, e usar
   * o estado defasado fazia tentar inserir sobre uma linha já existente (409,
   * pela chave única item+fornecedor).
   */
  async function salvarPreco(
    itemId: string, cfId: string, campos: Partial<CotacaoPreco>,
  ) {
    const { data: atual } = await sb
      .from("cotacao_precos")
      .select("id")
      .eq("cotacaoItemId", itemId)
      .eq("cotacaoFornecedorId", cfId)
      .maybeSingle();

    const { error } = atual
      ? await sb.from("cotacao_precos").update(campos).eq("id", (atual as { id: string }).id)
      : await sb.from("cotacao_precos").insert({
          id: novoId(), cotacaoItemId: itemId, cotacaoFornecedorId: cfId, ...campos,
        });

    if (error) return setErro(mensagemErro(error));

    // Primeiro preço lançado tira a cotação de "aguardando"
    if (cot?.status === "ABERTA") {
      await sb.from("cotacoes")
        .update({ status: "RESPONDIDA", atualizadoEm: agora() }).eq("id", id!);
    }
    await sb.from("cotacao_fornecedores")
      .update({ respondidoEm: agora() }).eq("id", cfId);

    await carregar();
  }

  async function adicionarItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from("cotacao_itens").insert({
      id: novoId(),
      cotacaoId: id,
      descricao: String(f.get("descricao") ?? "").trim(),
      quantidade: (Number(f.get("quantidade")) || 1).toFixed(2),
      unidade: String(f.get("unidade") ?? "un"),
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
      ordem: itens.length,
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setAddItem(false);
    await carregar();
  }

  async function adicionarFornecedor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from("cotacao_fornecedores").insert({
      id: novoId(),
      cotacaoId: id,
      fornecedorId: String(f.get("fornecedorId") ?? ""),
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setAddForn(false);
    await carregar();
  }

  async function removerItem(itemId: string) {
    setOcupado(true);
    await sb.from("cotacao_itens").delete().eq("id", itemId);
    setOcupado(false);
    await carregar();
  }

  async function removerFornecedor(cfId: string) {
    setOcupado(true);
    await sb.from("cotacao_fornecedores").delete().eq("id", cfId);
    setOcupado(false);
    await carregar();
  }

  async function salvarCondicoes(cfId: string, campos: Partial<CotacaoFornecedor>) {
    await sb.from("cotacao_fornecedores").update(campos).eq("id", cfId);
    await carregar();
  }

  async function decidir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!decidindo || !id) return;
    setOcupado(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const { data: r, error } = await sb.rpc("decidir_cotacao", {
      p_cotacao_id: id,
      p_fornecedor_id: decidindo,
      p_motivo: String(f.get("motivo") ?? "").trim() || null,
      p_gerar_despesa: f.get("gerarDespesa") === "on",
      p_vencimento: null,
    });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));

    const res = r as { fornecedor: string; total: number; lancamento_gerado: boolean };
    setDecidindo(null);
    setOk(
      `Cotação fechada com ${res.fornecedor} por ${brl(res.total)}.` +
      (res.lancamento_gerado ? " Despesa lançada no financeiro." : ""),
    );
    await carregar();
  }

  async function gerarPdf(tipo: "mapa" | "pedido", aba: Window | null) {
    if (!cot) return;
    setGerandoPdf(true);
    setErro(null);
    try {
      const { baixarPdfCotacao } = await import("@/pdf/gerar");
      await baixarPdfCotacao({
        cot, itens, comparativo, ordem,
        solicitante: cot.solicitanteId ? nomeFuncionario(cot.solicitanteId) : null,
        tipo,
      }, aba);
    } catch (e) {
      // Sem isto a aba reservada ficaria presa em "Gerando documento..."
      // para sempre, e o usuario nao saberia que deu errado.
      aba?.close();
      setErro(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    }
    setGerandoPdf(false);
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }
  if (!cot) return <Aviso tipo="erro">Cotação não encontrada.</Aviso>;

  const disponiveis = fornecedores.filter(
    (f) => !cfs.some((cf) => cf.fornecedorId === f.id));

  return (
    <>
      <TituloPagina
        titulo={`Cotação ${numeroDoc(cot.numero)}`}
        descricao={cot.descricao}
        acao={
          <>
            <Botao type="button" variante="secundario" disabled={gerandoPdf}
              onClick={() => void gerarPdf("mapa", reservarAba())}>
              <FileText className="h-4 w-4" aria-hidden />
              {gerandoPdf ? "Gerando..." : "Mapa comparativo"}
            </Botao>
            <Botao type="button" variante="fantasma" disabled={gerandoPdf}
              onClick={() => void gerarPdf("pedido", reservarAba())}>
              Pedido p/ fornecedor
            </Botao>
          </>
        }
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      {/* Resumo */}
      <Cartao className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid flex-1 gap-4 sm:grid-cols-4">
            <Dado rotulo="Status">
              <Badge cor={STATUS_COTACAO[cot.status].cor}>
                {STATUS_COTACAO[cot.status].label}
              </Badge>
            </Dado>
            <Dado rotulo="Aberta em">{data(cot.criadoEm)}</Dado>
            <Dado rotulo="Prazo de resposta">
              {cot.prazoResposta ? data(cot.prazoResposta) : "—"}
            </Dado>
            <Dado rotulo="Ordem de serviço">
              {ordem ? (
                <Link to={`/sistema/ordens/${ordem.id}`}
                  className="font-semibold text-marca-600 hover:underline">
                  OS {numeroDoc(ordem.numero)}
                </Link>
              ) : "Compra avulsa"}
            </Dado>
          </dl>
        </div>
        {cot.observacoes && (
          <p className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3 text-sm text-carvao-700">
            {cot.observacoes}
          </p>
        )}
        {cot.motivoDecisao && (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <strong>Motivo da escolha:</strong> {cot.motivoDecisao}
          </p>
        )}
      </Cartao>

      {/* Fornecedores consultados */}
      <Cartao className="mb-6">
        <CabecalhoCartao
          titulo="Fornecedores consultados"
          descricao={`${cfs.length} na disputa`}
          acao={
            editavel && !addForn && disponiveis.length > 0 && (
              <Botao type="button" variante="fantasma" onClick={() => setAddForn(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Incluir fornecedor
              </Botao>
            )
          } />

        {addForn && (
          <form onSubmit={adicionarFornecedor}
            className="flex flex-wrap items-end gap-3 border-b border-carvao-200 bg-carvao-50 p-5">
            <Selecao rotulo="Fornecedor" name="fornecedorId" required className="min-w-64">
              <option value="">Selecione...</option>
              {disponiveis.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </Selecao>
            <Botao type="submit" disabled={ocupado}>Incluir</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAddForn(false)}>
              Cancelar
            </Botao>
          </form>
        )}

        {cfs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carvao-500">
            Nenhum fornecedor incluído.{" "}
            {fornecedores.length === 0 && (
              <Link to="/sistema/fornecedores" className="font-semibold text-marca-600 hover:underline">
                Cadastre fornecedores primeiro.
              </Link>
            )}
          </p>
        ) : (
          <ul className="divide-y divide-carvao-100">
            {comparativo.colunas.map((col) => (
              <li key={col.cf.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-carvao-950">
                      {col.fornecedor?.nome ?? "—"}
                      {col.cf.vencedor && (
                        <Badge cor="bg-emerald-600 text-white" className="ml-2">
                          <Award className="mr-1 inline h-3 w-3" aria-hidden />
                          Vencedor
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-carvao-500">
                      {col.respondeu
                        ? `Cotou ${col.itensCotados} de ${itens.length} item(ns)`
                        : "Ainda não respondeu"}
                      {col.parcial && " · cotação parcial"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-extrabold text-carvao-950">
                      {brl(col.total)}
                    </p>
                    {(num(col.cf.frete) > 0 || num(col.cf.desconto) > 0) && (
                      <p className="text-xs text-carvao-500">
                        itens {brl(col.subtotal)}
                        {num(col.cf.frete) > 0 && ` + frete ${brl(col.cf.frete)}`}
                        {num(col.cf.desconto) > 0 && ` − desc. ${brl(col.cf.desconto)}`}
                      </p>
                    )}
                  </div>
                </div>

                {editavel && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Campo rotulo="Frete (R$)" type="number" step="0.01" min={0}
                      className="w-32" defaultValue={num(col.cf.frete)}
                      onBlur={(e) => void salvarCondicoes(col.cf.id,
                        { frete: (Number(e.target.value) || 0).toFixed(2) })} />
                    <Campo rotulo="Desconto (R$)" type="number" step="0.01" min={0}
                      className="w-32" defaultValue={num(col.cf.desconto)}
                      onBlur={(e) => void salvarCondicoes(col.cf.id,
                        { desconto: (Number(e.target.value) || 0).toFixed(2) })} />
                    <Campo rotulo="Prazo (dias)" type="number" min={0} className="w-28"
                      defaultValue={col.cf.prazoEntregaDias ?? ""}
                      onBlur={(e) => void salvarCondicoes(col.cf.id,
                        { prazoEntregaDias: Number(e.target.value) || null })} />
                    <Campo rotulo="Condições" className="w-56"
                      defaultValue={col.cf.condicoesPagamento ?? ""}
                      placeholder="30 dias, boleto..."
                      onBlur={(e) => void salvarCondicoes(col.cf.id,
                        { condicoesPagamento: e.target.value.trim() || null })} />
                    <button type="button" onClick={() => void removerFornecedor(col.cf.id)}
                      className="mb-1 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                      aria-label={`Remover ${col.fornecedor?.nome}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* Matriz comparativa */}
      <Cartao className="mb-6">
        <CabecalhoCartao
          titulo="Mapa comparativo"
          descricao="O menor preço de cada item aparece destacado"
          acao={
            editavel && !addItem && (
              <Botao type="button" variante="fantasma" onClick={() => setAddItem(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Adicionar item
              </Botao>
            )
          } />

        {addItem && (
          <form onSubmit={adicionarItem}
            className="grid gap-3 border-b border-carvao-200 bg-carvao-50 p-5 sm:grid-cols-6">
            <Campo rotulo="Descrição do item" name="descricao" required
              className="sm:col-span-3" placeholder="Farol dianteiro direito, tinta prata..." />
            <Campo rotulo="Qtd" name="quantidade" type="number" step="0.01" min={0.01}
              defaultValue={1} />
            <Selecao rotulo="Unidade" name="unidade" defaultValue="un">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </Selecao>
            <div className="flex items-end gap-2">
              <Botao type="submit" disabled={ocupado}>Adicionar</Botao>
              <Botao type="button" variante="fantasma" onClick={() => setAddItem(false)}>
                <X className="h-4 w-4" aria-hidden />
              </Botao>
            </div>
            <Campo rotulo="Observações" name="observacoes" className="sm:col-span-6"
              placeholder="Original ou paralela, código da peça..." />
          </form>
        )}

        {itens.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carvao-500">
            Nenhum item na cotação. Adicione o que precisa comprar.
          </p>
        ) : cfs.length === 0 ? (
          // Sem fornecedor a matriz nasce sem coluna de preco, e a tela parecia
          // quebrada — "cotacao sem campo de preco". O que falta e fornecedor.
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-semibold text-carvao-950">
              Nenhum fornecedor nesta cotação.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-carvao-500">
              Os campos de preço aparecem em uma coluna por fornecedor. Inclua ao menos
              dois no quadro acima para começar a comparar.
            </p>
            {editavel && disponiveis.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Botao type="button" onClick={() => setAddForn(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Incluir fornecedor
                </Botao>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-carvao-200 bg-carvao-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-carvao-600">
                    Item
                  </th>
                  {comparativo.colunas.map((col) => (
                    <th key={col.cf.id}
                      className="border-b border-carvao-200 bg-carvao-50 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-carvao-600">
                      {col.fornecedor?.nome ?? "—"}
                    </th>
                  ))}
                  <th className="border-b border-carvao-200 bg-carvao-50 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-carvao-600">
                    Variação
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparativo.linhas.map((linha) => (
                  <tr key={linha.item.id} className="hover:bg-carvao-50">
                    <td className="sticky left-0 z-10 border-b border-carvao-100 bg-white px-4 py-3">
                      <p className="font-medium text-carvao-950">{linha.item.descricao}</p>
                      <p className="text-xs text-carvao-500">
                        {num(linha.item.quantidade)} {linha.item.unidade}
                        {linha.item.observacoes && ` · ${linha.item.observacoes}`}
                      </p>
                      {editavel && (
                        <button type="button" onClick={() => void removerItem(linha.item.id)}
                          className="mt-1 text-xs font-semibold text-carvao-400 hover:text-marca-600">
                          remover
                        </button>
                      )}
                    </td>

                    {comparativo.colunas.map((col) => {
                      const c = linha.celulas.get(col.cf.id);
                      return (
                        <td key={col.cf.id}
                          className={`border-b border-carvao-100 px-3 py-3 text-center ${
                            c?.melhorDoItem ? "bg-emerald-50" : ""}`}>
                          {editavel ? (
                            <input
                              type="number" step="0.01" min={0}
                              defaultValue={c?.precoUnit || ""}
                              placeholder="—"
                              aria-label={`Preço de ${linha.item.descricao} em ${col.fornecedor?.nome}`}
                              onBlur={(e) => {
                                const v = Number(e.target.value) || 0;
                                if (v === (c?.precoUnit ?? 0)) return;
                                void salvarPreco(linha.item.id, col.cf.id, {
                                  precoUnit: v.toFixed(2),
                                  disponivel: v > 0,
                                });
                              }}
                              className={`w-24 rounded border px-2 py-1 text-center text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20 ${
                                c?.melhorDoItem
                                  ? "border-emerald-400 font-bold text-emerald-800"
                                  : "border-carvao-300"}`}
                            />
                          ) : (
                            <span className={c?.melhorDoItem
                              ? "font-bold text-emerald-700" : "text-carvao-700"}>
                              {c?.disponivel ? brl(c.precoUnit) : "—"}
                            </span>
                          )}
                          {c?.disponivel && (
                            <p className="mt-0.5 text-[10px] text-carvao-500">
                              total {brl(c.totalLinha)}
                            </p>
                          )}
                          {editavel && c?.disponivel && (
                            // Preco sozinho nao decide compra: peca paralela a
                            // R$80 e original a R$110 so da para comparar sabendo
                            // qual e qual, e de nada adianta a mais barata que
                            // chega depois de o carro ter de sair.
                            <div className="mt-1 flex justify-center gap-1">
                              <input
                                defaultValue={c.marca ?? ""}
                                placeholder="marca"
                                aria-label={`Marca ou procedência em ${col.fornecedor?.nome}`}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v === (c.marca ?? "")) return;
                                  void salvarPreco(linha.item.id, col.cf.id, { marca: v || null });
                                }}
                                className="w-16 rounded border border-carvao-200 px-1 py-0.5 text-[10px] focus:border-marca-500 focus:outline-none"
                              />
                              <input
                                type="number" min={0} step={1}
                                defaultValue={c.prazoDias ?? ""}
                                placeholder="dias"
                                aria-label={`Prazo de entrega em ${col.fornecedor?.nome}`}
                                onBlur={(e) => {
                                  const v = Number(e.target.value) || null;
                                  if (v === (c.prazoDias ?? null)) return;
                                  void salvarPreco(linha.item.id, col.cf.id, { prazoDias: v });
                                }}
                                className="w-12 rounded border border-carvao-200 px-1 py-0.5 text-[10px] focus:border-marca-500 focus:outline-none"
                              />
                            </div>
                          )}
                          {!editavel && (c?.marca || c?.prazoDias) && (
                            <p className="mt-0.5 text-[10px] text-carvao-500">
                              {[c.marca, c.prazoDias ? `${c.prazoDias}d` : null]
                                .filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                      );
                    })}

                    <td className="border-b border-carvao-100 px-4 py-3 text-right">
                      {linha.amplitude > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-marca-600">
                          <TrendingDown className="h-3 w-3" aria-hidden />
                          {brl(linha.amplitude)}
                        </span>
                      ) : (
                        <span className="text-xs text-carvao-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-carvao-50">
                  <td className="sticky left-0 z-10 bg-carvao-50 px-4 py-3 text-sm font-bold uppercase text-carvao-950">
                    Total
                  </td>
                  {comparativo.colunas.map((col) => (
                    <td key={col.cf.id} className="px-3 py-3 text-center">
                      <p className={`font-display text-lg font-extrabold ${
                        comparativo.melhorTotal?.cf.id === col.cf.id
                          ? "text-emerald-700" : "text-carvao-950"}`}>
                        {brl(col.total)}
                      </p>
                      {comparativo.melhorTotal?.cf.id === col.cf.id && (
                        <Badge cor="bg-emerald-600 text-white" className="mt-1">
                          melhor total
                        </Badge>
                      )}
                      {col.parcial && (
                        <Badge cor="bg-amber-600 text-white" className="mt-1">
                          parcial
                        </Badge>
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {comparativo.totalPorItem > 0 && (
          <div className="border-t border-carvao-200 p-5">
            <Aviso>
              {comparativo.melhorTotal ? (
                comparativo.economiaDividindo > 0 ? (
                  <>
                    Comprando cada item de quem cotou mais barato, o total sai{" "}
                    <strong>{brl(comparativo.totalPorItem)}</strong> — uma economia de{" "}
                    <strong>{brl(comparativo.economiaDividindo)}</strong> sobre o melhor
                    fornecedor único. Vale pesar o frete e o trabalho de comprar em dois lugares.
                  </>
                ) : (
                  <>
                    Fechar tudo com <strong>{comparativo.melhorTotal.fornecedor?.nome}</strong>{" "}
                    por <strong>{brl(comparativo.melhorTotal.total)}</strong> já é o melhor
                    negócio — dividir a compra não sairia mais barato.
                  </>
                )
              ) : (
                <>
                  Nenhum fornecedor cotou a lista inteira, então não dá para comparar totais
                  de forma justa. Comprando cada item de quem cotou mais barato, o total sai{" "}
                  <strong>{brl(comparativo.totalPorItem)}</strong>.
                </>
              )}
            </Aviso>
          </div>
        )}
      </Cartao>

      {/* Decisão */}
      {editavel && comparativo.colunas.some((c) => c.respondeu) && (
        <Cartao>
          <CabecalhoCartao titulo="Fechar a cotação"
            descricao="Escolha o fornecedor vencedor" />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              {comparativo.colunas.filter((c) => c.respondeu).map((col) => (
                <Botao key={col.cf.id} type="button"
                  variante={comparativo.melhorTotal?.cf.id === col.cf.id ? "primario" : "fantasma"}
                  onClick={() => setDecidindo(col.cf.id)}>
                  {col.fornecedor?.nome} — {brl(col.total)}
                </Botao>
              ))}
            </div>

            {decidindo && (
              <form onSubmit={decidir}
                className="space-y-4 rounded-md border border-carvao-300 bg-carvao-50 p-4">
                <p className="text-sm text-carvao-700">
                  Fechando com{" "}
                  <strong>
                    {comparativo.colunas.find((c) => c.cf.id === decidindo)?.fornecedor?.nome}
                  </strong>.
                </p>
                <AreaTexto rotulo="Motivo da escolha" name="motivo" rows={2}
                  placeholder="Se não foi o mais barato, registre o porquê: prazo, qualidade da peça, condição de pagamento..." />
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="gerarDespesa" defaultChecked
                    className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]" />
                  <span className="text-sm text-carvao-800">
                    <strong className="block">Lançar a despesa no financeiro</strong>
                    <span className="text-carvao-600">
                      Cria a conta a pagar com vencimento em 30 dias.
                    </span>
                  </span>
                </label>
                <div className="flex gap-2">
                  <Botao type="submit" disabled={ocupado}>
                    <Award className="h-4 w-4" aria-hidden />
                    {ocupado ? "Fechando..." : "Confirmar vencedor"}
                  </Botao>
                  <Botao type="button" variante="fantasma" onClick={() => setDecidindo(null)}>
                    Cancelar
                  </Botao>
                </div>
              </form>
            )}
          </div>
        </Cartao>
      )}
    </>
  );
}
