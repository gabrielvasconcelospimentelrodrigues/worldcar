import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, CabecalhoCartao, Selecao, TituloPagina,
} from "@/componentes/ui";
import { CATEGORIA_SERVICO } from "@/lib/constantes";
import { brl, num, numeroDoc, placa as formatarPlaca, somaDias, telefone } from "@/lib/format";
import { BuscaSelecao } from "@/componentes/busca-selecao";
import {
  agora, catalogoAtivo, clientesComVeiculos, novoId, porCategoria,
  type ClienteComVeiculos,
} from "@/lib/consultas";
import { mensagemErro, sb } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao-contexto";
import type { Orcamento, OrcamentoItem, Servico } from "@/lib/tipos";

type Linha = {
  chave: string;
  servicoId: string;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  desconto: number;
  garantiaDias: number;
};

const chaveNova = () => Math.random().toString(36).slice(2, 10);
const linhaVazia = (): Linha => ({
  chave: chaveNova(), servicoId: "", descricao: "",
  quantidade: 1, precoUnit: 0, desconto: 0, garantiaDias: 0,
});

export function EditorOrcamento() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { eu } = useSessao();
  const editando = Boolean(id && id !== "novo");

  const [clientes, setClientes] = useState<ClienteComVeiculos[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState<number | null>(null);

  const [clienteId, setClienteId] = useState(params.get("cliente") ?? "");
  const [veiculoId, setVeiculoId] = useState("");
  const [validadeDias, setValidadeDias] = useState(10);
  const [kmVeiculo, setKmVeiculo] = useState<string>("");
  const [descontoTipo, setDescontoTipo] = useState("VALOR");
  const [desconto, setDesconto] = useState(0);
  const [prazo, setPrazo] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [cs, sv] = await Promise.all([clientesComVeiculos(), catalogoAtivo()]);
      if (!vivo) return;
      setClientes(cs);
      setServicos(sv);

      if (editando && id) {
        const [{ data: o }, { data: itens }] = await Promise.all([
          sb.from("orcamentos").select("*").eq("id", id).maybeSingle(),
          sb.from("orcamento_itens").select("*").eq("orcamentoId", id).order("ordem"),
        ]);
        if (!vivo) return;
        const orc = o as Orcamento | null;
        if (orc) {
          if (orc.status === "CONVERTIDO") {
            navegar(`/sistema/orcamentos/${id}`, { replace: true });
            return;
          }
          setNumero(orc.numero);
          setClienteId(orc.clienteId);
          setVeiculoId(orc.veiculoId);
          setValidadeDias(orc.validadeDias);
          setKmVeiculo(orc.kmVeiculo ? String(orc.kmVeiculo) : "");
          setDescontoTipo(orc.descontoTipo === "PERCENTUAL" ? "PERCENTUAL" : "VALOR");
          setDesconto(num(orc.desconto));
          setPrazo(orc.prazoEntregaDias ? String(orc.prazoEntregaDias) : "");
          setFormaPagamento(orc.formaPagamento ?? "");
          setObservacoes(orc.observacoes ?? "");
          setLinhas(
            ((itens as OrcamentoItem[]) ?? []).map((i) => ({
              chave: chaveNova(),
              servicoId: i.servicoId ?? "",
              descricao: i.descricao,
              quantidade: num(i.quantidade),
              precoUnit: num(i.precoUnit),
              desconto: num(i.desconto),
              garantiaDias: sv.find((s) => s.id === i.servicoId)?.garantiaDias ?? 0,
            })),
          );
        }
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [editando, id, navegar]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const veiculos = cliente?.veiculos ?? [];
  const descontoDoCliente = num(cliente?.descontoPct ?? 0);

  /**
   * As placas entram no texto de busca: na oficina o atendente costuma ter a
   * placa na mao antes do nome do dono.
   */
  const opcoesCliente = useMemo(
    () => clientes.map((c) => {
      const placas = (c.veiculos ?? []).map((v) => v.placa).join(" ");
      return {
        valor: c.id,
        rotulo: c.nome,
        detalhe: [telefone(c.telefone), placas].filter(Boolean).join(" · "),
        busca: `${c.nome} ${c.telefone} ${placas}`,
      };
    }),
    [clientes],
  );
  const grupos = useMemo(() => porCategoria(servicos), [servicos]);

  const totais = useMemo(() => {
    const subtotal = linhas.reduce(
      (s, l) => s + Math.max(0, l.quantidade * l.precoUnit - l.desconto), 0);
    const abatimento =
      descontoTipo === "PERCENTUAL"
        ? (subtotal * Math.min(Math.max(desconto, 0), 100)) / 100
        : Math.max(desconto, 0);
    return { subtotal, abatimento, total: Math.max(0, subtotal - abatimento) };
  }, [linhas, descontoTipo, desconto]);

  const atualizar = (chave: string, m: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...m } : l)));

  function escolherServico(chave: string, servicoId: string) {
    const s = servicos.find((x) => x.id === servicoId);
    atualizar(chave, {
      servicoId,
      descricao: s?.nome ?? "",
      precoUnit: s ? num(s.preco) : 0,
      garantiaDias: s?.garantiaDias ?? 0,
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const itens = linhas.filter((l) => l.descricao.trim());
    if (!clienteId || !veiculoId) return setErro("Selecione o cliente e o veículo.");
    if (itens.length === 0) return setErro("Adicione pelo menos um item ao orçamento.");

    setSalvando(true);
    const cabecalho = {
      clienteId, veiculoId,
      vendedorId: eu?.id ?? null,
      validadeDias,
      validoAte: somaDias(new Date(), validadeDias).toISOString(),
      kmVeiculo: kmVeiculo ? Number(kmVeiculo.replace(/\D/g, "")) || null : null,
      subtotal: totais.subtotal.toFixed(2),
      descontoTipo,
      desconto: desconto.toFixed(2),
      total: totais.total.toFixed(2),
      prazoEntregaDias: prazo ? Number(prazo) || null : null,
      formaPagamento: formaPagamento.trim() || null,
      observacoes: observacoes.trim() || null,
      atualizadoEm: agora(),
    };

    const alvo = editando && id ? id : novoId();

    if (editando) {
      const { error } = await sb.from("orcamentos").update(cabecalho).eq("id", alvo);
      if (error) { setSalvando(false); return setErro(mensagemErro(error)); }
      await sb.from("orcamento_itens").delete().eq("orcamentoId", alvo);
    } else {
      const { error } = await sb
        .from("orcamentos")
        .insert({ ...cabecalho, id: alvo, status: "RASCUNHO" });
      if (error) { setSalvando(false); return setErro(mensagemErro(error)); }
    }

    const { error: erroItens } = await sb.from("orcamento_itens").insert(
      itens.map((l, idx) => ({
        id: novoId(),
        orcamentoId: alvo,
        servicoId: l.servicoId || null,
        descricao: l.descricao,
        quantidade: l.quantidade.toFixed(2),
        precoUnit: l.precoUnit.toFixed(2),
        desconto: l.desconto.toFixed(2),
        total: Math.max(0, l.quantidade * l.precoUnit - l.desconto).toFixed(2),
        ordem: idx,
      })),
    );

    setSalvando(false);
    if (erroItens) return setErro(mensagemErro(erroItens));
    navegar(`/sistema/orcamentos/${alvo}`);
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <>
      <TituloPagina
        titulo={editando ? `Editar orçamento ${numero ? numeroDoc(numero) : ""}` : "Novo orçamento"}
        descricao={
          editando
            ? "Salvar substitui os itens e recalcula os totais."
            : "Monte a proposta; o PDF com as três vias sai depois de salvar."
        }
      />

      {clientes.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Nenhum cliente cadastrado. Cadastre o primeiro cliente antes de abrir um orçamento.
          </Aviso>
        </div>
      )}

      <form onSubmit={salvar} className="space-y-6">
        <Cartao>
          <CabecalhoCartao titulo="Cliente e veículo" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <BuscaSelecao
              rotulo="Cliente" required valor={clienteId}
              opcoes={opcoesCliente}
              placeholder="Buscar por nome, telefone ou placa..."
              vazio="Nenhum cliente encontrado."
              aoEscolher={(novo) => {
                setClienteId(novo);
                setVeiculoId("");
                // Aplica o desconto negociado com aquele cliente. So em orcamento
                // novo: num orcamento ja salvo, sobrescrever apagaria um desconto
                // que alguem ajustou a mao.
                if (!editando) {
                  const pct = num(clientes.find((c) => c.id === novo)?.descontoPct ?? 0);
                  if (pct > 0) { setDescontoTipo("PERCENTUAL"); setDesconto(pct); }
                }
              }}
            />

            {descontoDoCliente > 0 && (
              <p className="-mt-2 text-xs font-semibold text-emerald-700 sm:col-span-2">
                {cliente?.nome} tem {descontoDoCliente}% de desconto negociado.
              </p>
            )}

            <BuscaSelecao
              rotulo="Veículo" required valor={veiculoId} disabled={!cliente}
              opcoes={veiculos.map((v) => ({
                valor: v.id,
                rotulo: `${formatarPlaca(v.placa)} — ${v.marca} ${v.modelo}`,
              }))}
              placeholder={cliente ? "Buscar veículo..." : "Escolha o cliente primeiro"}
              vazio="Este cliente não tem veículo cadastrado."
              dica={cliente && veiculos.length === 0
                ? "Este cliente não tem veículos. Cadastre um na ficha dele."
                : undefined}
              aoEscolher={setVeiculoId}
            />

            <Campo
              rotulo="KM do veículo" type="number" min={0}
              value={kmVeiculo}
              onChange={(e) => setKmVeiculo(e.target.value)}
              placeholder={String(veiculos.find((v) => v.id === veiculoId)?.km ?? "")}
            />
            <Campo
              rotulo="Validade do orçamento (dias)" type="number" min={1} max={365} required
              value={validadeDias}
              onChange={(e) => setValidadeDias(Number(e.target.value) || 1)}
            />
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao
            titulo="Serviços orçados"
            descricao="Escolha do catálogo ou descreva um item avulso."
            acao={
              <Botao type="button" variante="fantasma"
                onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}>
                <Plus className="h-4 w-4" aria-hidden />
                Adicionar item
              </Botao>
            }
          />
          <div className="divide-y divide-carvao-100">
            {linhas.map((l, idx) => {
              const totalLinha = Math.max(0, l.quantidade * l.precoUnit - l.desconto);
              return (
                <div key={l.chave} className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-carvao-500">
                      Item {idx + 1}
                      {l.garantiaDias > 0 && (
                        <span className="ml-2 font-medium normal-case text-marca-600">
                          garantia de {l.garantiaDias} dias
                        </span>
                      )}
                    </span>
                    {linhas.length > 1 && (
                      <button type="button"
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                        className="rounded p-1.5 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                        aria-label={`Remover item ${idx + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-12">
                    <Selecao rotulo="Serviço do catálogo" className="lg:col-span-4"
                      value={l.servicoId}
                      onChange={(e) => escolherServico(l.chave, e.target.value)}>
                      <option value="">— item avulso —</option>
                      {grupos.map(([cat, lista]) => (
                        <optgroup key={cat} label={CATEGORIA_SERVICO[cat as keyof typeof CATEGORIA_SERVICO]}>
                          {lista.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.codigo} · {s.nome} ({brl(s.preco)})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Selecao>

                    <Campo rotulo="Descrição" className="lg:col-span-4" value={l.descricao}
                      onChange={(e) => atualizar(l.chave, { descricao: e.target.value })}
                      placeholder="Descrição que aparece no PDF" />
                    <Campo rotulo="Qtd" type="number" step="0.01" min={0.01} className="lg:col-span-1"
                      value={l.quantidade}
                      onChange={(e) => atualizar(l.chave, { quantidade: Number(e.target.value) || 0 })} />
                    <Campo rotulo="Preço un." type="number" step="0.01" min={0} className="lg:col-span-1"
                      value={l.precoUnit}
                      onChange={(e) => atualizar(l.chave, { precoUnit: Number(e.target.value) || 0 })} />
                    <Campo rotulo="Desc. R$" type="number" step="0.01" min={0} className="lg:col-span-1"
                      value={l.desconto}
                      onChange={(e) => atualizar(l.chave, { desconto: Number(e.target.value) || 0 })} />
                    <div className="lg:col-span-1">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                        Total
                      </span>
                      <p className="py-2 text-sm font-bold text-carvao-950">{brl(totalLinha)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-carvao-200 bg-carvao-50 p-5">
            <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <Selecao rotulo="Tipo de desconto" value={descontoTipo}
                onChange={(e) => setDescontoTipo(e.target.value)}>
                <option value="VALOR">Valor (R$)</option>
                <option value="PERCENTUAL">Percentual (%)</option>
              </Selecao>
              <Campo
                rotulo={`Desconto geral (${descontoTipo === "PERCENTUAL" ? "%" : "R$"})`}
                type="number" step="0.01" min={0} value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value) || 0)} />
              <dl className="space-y-1 text-sm sm:text-right">
                <div className="flex justify-between gap-6 sm:justify-end">
                  <dt className="text-carvao-600">Subtotal</dt>
                  <dd className="font-medium">{brl(totais.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-6 sm:justify-end">
                  <dt className="text-carvao-600">Desconto</dt>
                  <dd className="font-medium text-marca-600">− {brl(totais.abatimento)}</dd>
                </div>
                <div className="flex justify-between gap-6 border-t border-carvao-300 pt-1 sm:justify-end">
                  <dt className="font-bold text-carvao-950">Total</dt>
                  <dd className="font-display text-2xl font-extrabold text-carvao-950">
                    {brl(totais.total)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Condições" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo rotulo="Prazo de entrega (dias úteis)" type="number" min={0}
              value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            <Campo rotulo="Forma de pagamento" value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="PIX, cartão em até 3x, 50% entrada..." />
            <AreaTexto rotulo="Observações (saem no PDF)" className="sm:col-span-2"
              value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Condições especiais, peças não inclusas, ressalvas..." />
          </div>
        </Cartao>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex justify-end">
          <Botao type="submit" disabled={salvando} className="px-6 py-2.5">
            {salvando ? "Salvando..." : editando ? "Salvar orçamento" : "Gerar orçamento"}
          </Botao>
        </div>
      </form>
    </>
  );
}
