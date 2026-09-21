import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2, ClipboardCheck, FileText, LogIn, LogOut, MessageCircle, Trash2,
} from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, Campo, Cartao, CabecalhoCartao,
  Dado, Selecao, TituloPagina,
} from "@/componentes/ui";
import { CampoAssinatura } from "@/componentes/assinatura";
import { FORMA_PAGAMENTO, STATUS_ITEM_OS, STATUS_OS } from "@/lib/constantes";
import { brl, dataHora, linkWhatsapp, num, numeroDoc, telefone } from "@/lib/format";
import { useEquipe } from "@/lib/equipe";
import { ConferirLimpeza } from "@/componentes/conferir-limpeza";
import { PagamentosOs } from "@/componentes/pagamentos-os";
import { mensagemErro, sb } from "@/lib/supabase";
import type {
  Cliente, Comissao, OrdemServico, OrdemServicoItem, StatusItemOS, Veiculo, Vistoria,
} from "@/lib/tipos";
import { reservarAba } from "@/pdf/aba";

/** Transicoes manuais; a entrega tem fluxo proprio. */
const TRANSICOES: Record<string, string[]> = {
  AGUARDANDO: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["PAUSADA", "PRONTA", "CANCELADA"],
  PAUSADA: ["EM_ANDAMENTO", "CANCELADA"],
  PRONTA: ["EM_ANDAMENTO"],
  ENTREGUE: [],
  CANCELADA: [],
};

/**
 * Categorias em que a conferencia de limpeza faz sentido. Decidir pela
 * categoria do catalogo, e nao por palavra na descricao: "polimento tecnico"
 * nao tem "lavagem" no nome e mesmo assim precisa ser conferido, enquanto
 * "lavagem de bico injetor" tem e nao precisa.
 */
const CATEGORIAS_COM_CONFERENCIA = new Set([
  "LAVAGEM", "ESTETICA", "REVITALIZACAO", "VITRIFICACAO",
]);

type ItemComCategoria = OrdemServicoItem & {
  servicos: { categoria: string } | null;
};

export function FichaOrdem() {
  const { id } = useParams<{ id: string }>();
  const { ativos, nome: nomeFuncionario, membro } = useEquipe();

  const [os, setOs] = useState<OrdemServico | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<ItemComCategoria[]>([]);
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [formSaida, setFormSaida] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [o, its, vis, com] = await Promise.all([
      sb.from("ordens_servico").select("*").eq("id", id).maybeSingle(),
      sb.from("os_itens").select("*, servicos(categoria)").eq("ordemId", id).order("id"),
      sb.from("vistorias").select("*").eq("ordemId", id).order("data"),
      sb.from("comissoes").select("*").eq("ordemId", id),
    ]);

    const oo = o.data as OrdemServico | null;
    setOs(oo);
    setItens((its.data as unknown as ItemComCategoria[]) ?? []);
    setVistorias((vis.data as Vistoria[]) ?? []);
    setComissoes((com.data as Comissao[]) ?? []);

    if (oo) {
      const [c, v] = await Promise.all([
        sb.from("clientes").select("*").eq("id", oo.clienteId).maybeSingle(),
        sb.from("veiculos").select("*").eq("id", oo.veiculoId).maybeSingle(),
      ]);
      setCliente(c.data as Cliente);
      setVeiculo(v.data as Veiculo);
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvarItem(item: OrdemServicoItem, status: StatusItemOS, responsavelId: string) {
    if (!id) return;
    setOcupado(true);
    setErro(null);

    const { error } = await sb.from("os_itens").update({
      status,
      responsavelId: responsavelId || null,
      iniciadoEm: status === "EXECUTANDO" && !item.iniciadoEm
        ? new Date().toISOString() : item.iniciadoEm,
      concluidoEm: status === "CONCLUIDO" ? new Date().toISOString() : null,
    }).eq("id", item.id);

    if (error) { setOcupado(false); return setErro(mensagemErro(error)); }

    // Totais e status da OS sao recalculados no banco, para a regra ficar
    // num lugar so e fora do alcance do navegador.
    await sb.rpc("recalcular_ordem", { p_ordem_id: id });
    await sb.rpc("ajustar_status_ordem", { p_ordem_id: id });

    setOcupado(false);
    await carregar();
  }

  async function removerItem(itemId: string) {
    if (!id) return;
    setOcupado(true);
    const { error } = await sb.from("os_itens").delete().eq("id", itemId);
    if (error) { setOcupado(false); return setErro(mensagemErro(error)); }
    await sb.rpc("recalcular_ordem", { p_ordem_id: id });
    await sb.rpc("ajustar_status_ordem", { p_ordem_id: id });
    setOcupado(false);
    await carregar();
  }

  async function mudarStatus(novo: string) {
    if (!id) return;
    setOcupado(true);
    const { error } = await sb.from("ordens_servico")
      .update({ status: novo, atualizadoEm: new Date().toISOString() })
      .eq("id", id);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    await carregar();
  }

  async function entregar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    setOcupado(true);
    setErro(null);
    setOk(null);

    const f = new FormData(e.currentTarget);
    const forma = String(f.get("formaPagamento") ?? "");

    // Uma chamada so: valida, registra a saida, lanca a receita, calcula as
    // comissoes e cria os alertas — tudo numa transacao dentro do Postgres.
    const { data: resultado, error } = await sb.rpc("entregar_ordem", {
      p_ordem_id: id,
      p_funcionario_saida: String(f.get("funcionarioSaidaId") ?? ""),
      p_cliente_retirou: String(f.get("clienteRetirou") ?? ""),
      p_km_saida: Number(String(f.get("kmSaida") ?? "").replace(/\D/g, "")) || null,
      p_documento_retirada: String(f.get("documentoRetirada") ?? "") || null,
      p_observacoes_saida: String(f.get("observacoesSaida") ?? "") || null,
      p_forma_pagamento: forma || null,
      p_parcelas: Number(f.get("parcelas")) || 1,
      p_assinatura_entrega: String(f.get("assinaturaEntrega") ?? "") || null,
      // Sem isto tudo nascia PENDENTE, inclusive o PIX pago no balcao, e alguem
      // precisava lembrar de dar baixa no financeiro depois.
      p_pago_agora: f.get("pagoAgora") === "on",
    });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));

    const r = resultado as { comissoes_geradas: number; alertas_gerados: number };
    setFormSaida(false);
    setOk(
      `Veículo entregue. ${r.alertas_gerados} alerta(s) de retorno e ${r.comissoes_geradas} comissão(ões) gerados.`,
    );
    await carregar();
  }

  async function gerarPdf(baixar: boolean, aba: Window | null) {
    if (!os || !cliente || !veiculo) return;
    setGerandoPdf(true);
    setErro(null);
    try {
      const { baixarPdfOrdem } = await import("@/pdf/gerar");
      await baixarPdfOrdem({ os, cliente, veiculo, itens, nomeFuncionario }, baixar, aba);
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
  if (!os || !cliente || !veiculo) {
    return <Aviso tipo="erro">Ordem de serviço não encontrada.</Aviso>;
  }

  const editavel = !["ENTREGUE", "CANCELADA"].includes(os.status);
  const pendencias = itens.filter(
    (i) => i.status !== "CONCLUIDO" && i.status !== "CANCELADO",
  ).length;
  const vistoriaEntrada = vistorias.find((v) => v.tipo === "ENTRADA");
  const vistoriaSaida = vistorias.find((v) => v.tipo === "SAIDA");
  const bloqueado = pendencias > 0 || !vistoriaSaida;
  const concluidos = itens.filter((i) => i.status === "CONCLUIDO").length;

  const zap = `Olá ${cliente.nome.split(" ")[0]}! Seu ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}) — OS ${numeroDoc(os.numero)} — está ${
    os.status === "PRONTA" ? "pronto para retirada" : "em atendimento na World Car Service"
  }.`;

  return (
    <>
      <TituloPagina
        titulo={`OS ${numeroDoc(os.numero)}`}
        descricao={`${cliente.nome} · ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa})`}
        acao={
          <>
            <Botao type="button" variante="secundario" disabled={gerandoPdf}
              onClick={() => void gerarPdf(false, reservarAba())}>
              <FileText className="h-4 w-4" aria-hidden />
              {gerandoPdf ? "Gerando..." : "PDF (3 vias)"}
            </Botao>
            <Botao type="button" variante="fantasma" disabled={gerandoPdf}
              onClick={() => void gerarPdf(true, null)}>
              Baixar
            </Botao>
            <a href={linkWhatsapp(cliente.telefone, zap)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Avisar cliente
            </a>
          </>
        }
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Itens */}
          <Cartao>
            <CabecalhoCartao titulo="Serviços da OS"
              descricao={`${concluidos} de ${itens.length} concluído(s)`} />
            <ul className="divide-y divide-carvao-100">
              {itens.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-carvao-500">
                  Nenhum serviço nesta OS.
                </li>
              )}
              {itens.map((i) => (
                <li key={i.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-carvao-950">{i.descricao}</p>
                      <p className="mt-0.5 text-xs text-carvao-500">
                        {num(i.quantidade)} × {brl(i.precoUnit)} ={" "}
                        <strong className="text-carvao-800">{brl(i.total)}</strong>
                        {i.garantiaDias > 0 && ` · garantia de ${i.garantiaDias} dias`}
                      </p>
                      {(i.iniciadoEm || i.concluidoEm) && (
                        <p className="mt-1 text-xs text-carvao-500">
                          {i.iniciadoEm && `Iniciado ${dataHora(i.iniciadoEm)}`}
                          {i.iniciadoEm && i.concluidoEm && " · "}
                          {i.concluidoEm && `Concluído ${dataHora(i.concluidoEm)}`}
                        </p>
                      )}
                    </div>
                    <Badge cor={STATUS_ITEM_OS[i.status].cor}>
                      {STATUS_ITEM_OS[i.status].label}
                    </Badge>
                  </div>

                  {editavel && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void salvarItem(
                          i,
                          String(f.get("status")) as StatusItemOS,
                          String(f.get("responsavelId") ?? ""),
                        );
                      }}
                      className="mt-3 flex flex-wrap items-end gap-2"
                    >
                      <Selecao rotulo="Responsável" name="responsavelId" className="w-52"
                        defaultValue={i.responsavelId ?? ""}>
                        <option value="">Não atribuído</option>
                        {ativos.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </Selecao>
                      <Selecao rotulo="Situação" name="status" className="w-40"
                        defaultValue={i.status}>
                        {Object.entries(STATUS_ITEM_OS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </Selecao>
                      <div className="pb-0.5">
                        <Botao type="submit" variante="fantasma" disabled={ocupado}
                          className="px-3 py-1.5 text-xs">
                          Salvar
                        </Botao>
                      </div>
                      <button type="button" onClick={() => void removerItem(i.id)}
                        className="mb-0.5 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                        aria-label={`Remover ${i.descricao}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                  )}

                  {/* So faz sentido conferir limpeza no que foi lavado. Pedir ao
                      vistoriador que confira "troca de pastilha" seria ruido. */}
                  {editavel && i.servicos
                    && CATEGORIAS_COM_CONFERENCIA.has(i.servicos.categoria) && (
                    <ConferirLimpeza
                      itemId={i.id}
                      descricao={i.descricao}
                      equipe={ativos}
                      aoConferir={() => void carregar()}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Cartao>

          {/* Andamento e saida */}
          <Cartao>
            <CabecalhoCartao titulo="Andamento e saída"
              descricao={`Situação atual: ${STATUS_OS[os.status].label}`} />
            <div className="space-y-4 p-5">
              {editavel && TRANSICOES[os.status]?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {TRANSICOES[os.status].map((t) => (
                    <Botao key={t} type="button" disabled={ocupado}
                      variante={t === "CANCELADA" ? "perigo" : "fantasma"}
                      onClick={() => void mudarStatus(t)}>
                      {t === "CANCELADA"
                        ? "Cancelar OS"
                        : `Marcar: ${STATUS_OS[t as keyof typeof STATUS_OS].label}`}
                    </Botao>
                  ))}
                </div>
              )}

              {os.status === "ENTREGUE" ? (
                <Aviso tipo="sucesso">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Serviço finalizado e veículo entregue. Os alertas de retorno de garantia
                    e de pós-venda já foram criados.
                  </span>
                </Aviso>
              ) : os.status === "CANCELADA" ? (
                <Aviso tipo="erro">Esta OS foi cancelada.</Aviso>
              ) : (
                <>
                  {bloqueado && (
                    <Aviso>
                      Para entregar o veículo faltam:
                      <ul className="mt-1.5 list-inside list-disc">
                        {pendencias > 0 && (
                          <li>{pendencias} serviço(s) a concluir ou cancelar</li>
                        )}
                        {!vistoriaSaida && (
                          <li>
                            vistoria de saída —{" "}
                            <Link to={`/sistema/vistorias/nova?ordem=${os.id}&tipo=SAIDA`}
                              className="font-semibold underline">
                              registrar agora
                            </Link>
                          </li>
                        )}
                      </ul>
                    </Aviso>
                  )}

                  {!formSaida ? (
                    <Botao type="button" disabled={bloqueado} className="px-6 py-2.5"
                      onClick={() => setFormSaida(true)}>
                      Registrar saída do veículo
                    </Botao>
                  ) : (
                    <form onSubmit={entregar}
                      className="space-y-4 rounded-md border border-carvao-300 bg-carvao-50 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Selecao rotulo="Funcionário que entregou" name="funcionarioSaidaId"
                          dica="Responsável pela saída" required>
                          <option value="">Selecione...</option>
                          {ativos.map((f) => (
                            <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                          ))}
                        </Selecao>
                        <Campo rotulo="KM na saída" name="kmSaida" type="number"
                          min={os.kmEntrada ?? 0} defaultValue={os.kmEntrada ?? ""} />
                        <Campo rotulo="Quem retirou o veículo" name="clienteRetirou"
                          defaultValue={cliente.nome} required />
                        <Campo rotulo="Documento de quem retirou" name="documentoRetirada"
                          placeholder="RG ou CPF" />
                        <Selecao rotulo="Forma de pagamento" name="formaPagamento">
                          <option value="">Definir depois</option>
                          {Object.entries(FORMA_PAGAMENTO).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </Selecao>
                        <Campo rotulo="Parcelas" name="parcelas" type="number" min={1} max={24}
                          defaultValue={1} dica={`Total de ${brl(os.total)}`} />
                        <label className="flex items-start gap-2.5 rounded-md border border-carvao-300 bg-white p-3 sm:col-span-2">
                          <input type="checkbox" name="pagoAgora" defaultChecked
                            className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]" />
                          <span className="text-sm">
                            <span className="block font-semibold text-carvao-950">
                              O cliente pagou agora
                            </span>
                            <span className="block text-xs text-carvao-500">
                              Desmarque se ficou a prazo. Parcelado, só a primeira entra
                              como paga.
                            </span>
                          </span>
                        </label>
                        <AreaTexto rotulo="Observações da saída" name="observacoesSaida" rows={2}
                          className="sm:col-span-2"
                          placeholder="Orientações dadas ao cliente, itens devolvidos..." />
                        <div className="sm:col-span-2">
                          <CampoAssinatura name="assinaturaEntrega"
                            rotulo="Assinatura de recebimento do veículo"
                            dica="Peça ao cliente para assinar na tela. Fica gravada na OS e sai no PDF." />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Botao type="submit" disabled={ocupado} className="px-6 py-2.5">
                          {ocupado ? "Registrando..." : "Confirmar entrega do veículo"}
                        </Botao>
                        <Botao type="button" variante="fantasma" onClick={() => setFormSaida(false)}>
                          Cancelar
                        </Botao>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </Cartao>

          <PagamentosOs
            ordemId={os.id}
            clienteId={os.clienteId}
            entregue={os.status === "ENTREGUE"}
            editavel={os.status !== "CANCELADA"}
            aoMudar={() => void carregar()}
          />

          {/* Vistorias */}
          <Cartao>
            <CabecalhoCartao titulo="Vistorias"
              descricao="Estado do veículo na entrada e na saída" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {([["ENTRADA", vistoriaEntrada, LogIn], ["SAIDA", vistoriaSaida, LogOut]] as const).map(
                ([tipo, v, Icone]) => (
                  <div key={tipo}
                    className={`rounded-lg border p-4 ${
                      v ? "border-emerald-200 bg-emerald-50" : "border-carvao-200 bg-carvao-50"
                    }`}>
                    <div className="flex items-center gap-2">
                      <Icone className="h-4 w-4 text-carvao-600" aria-hidden />
                      <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                        {tipo === "ENTRADA" ? "Vistoria de entrada" : "Vistoria de saída"}
                      </h3>
                    </div>
                    {v ? (
                      <>
                        <p className="mt-2 text-sm text-carvao-700">
                          {dataHora(v.data)} · {nomeFuncionario(v.funcionarioId)}
                        </p>
                        <Link to={`/sistema/vistorias/${v.id}`}
                          className="mt-2 inline-block text-sm font-semibold text-marca-600 hover:underline">
                          Ver laudo
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-carvao-600">Ainda não registrada.</p>
                        {editavel && (
                          <Link to={`/sistema/vistorias/nova?ordem=${os.id}&tipo=${tipo}`}
                            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 hover:underline">
                            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                            Registrar agora
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                ),
              )}
            </div>
          </Cartao>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Cartao className="p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
                Resumo
              </h2>
              <Badge cor={STATUS_OS[os.status].cor}>{STATUS_OS[os.status].label}</Badge>
            </div>
            <dl className="space-y-3">
              <Dado rotulo="Cliente">
                <Link to={`/sistema/clientes/${cliente.id}`}
                  className="font-semibold text-marca-600 hover:underline">
                  {cliente.nome}
                </Link>
              </Dado>
              <Dado rotulo="Telefone">{telefone(cliente.telefone)}</Dado>
              <Dado rotulo="Veículo">
                {veiculo.marca} {veiculo.modelo} · {veiculo.placa}
              </Dado>
              {os.orcamentoId && (
                <Dado rotulo="Origem">
                  <Link to={`/sistema/orcamentos/${os.orcamentoId}`}
                    className="font-semibold text-marca-600 hover:underline">
                    Ver orçamento
                  </Link>
                </Dado>
              )}
              <Dado rotulo="Previsão de entrega">
                {os.previsaoEntrega ? dataHora(os.previsaoEntrega) : "A definir"}
              </Dado>
              <Dado rotulo="Total">
                <span className="font-display text-xl font-extrabold text-carvao-950">
                  {brl(os.total)}
                </span>
              </Dado>
            </dl>
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <LogIn className="h-4 w-4 text-marca-500" aria-hidden />
              Entrada
            </h2>
            <dl className="space-y-3">
              <Dado rotulo="Data e hora">{dataHora(os.dataEntrada)}</Dado>
              <Dado rotulo="Recebido por">
                <span className="font-semibold">{nomeFuncionario(os.funcionarioEntradaId)}</span>
                <span className="block text-xs text-carvao-500">
                  {membro(os.funcionarioEntradaId)?.cargo ?? ""}
                </span>
              </Dado>
              <Dado rotulo="KM">
                {os.kmEntrada ? os.kmEntrada.toLocaleString("pt-BR") : "—"}
              </Dado>
              <Dado rotulo="Combustível">{os.combustivelEntrada ?? "—"}</Dado>
              {os.observacoesEntrada && (
                <Dado rotulo="Observações">
                  <span className="whitespace-pre-wrap">{os.observacoesEntrada}</span>
                </Dado>
              )}
            </dl>
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <LogOut className="h-4 w-4 text-marca-500" aria-hidden />
              Saída
            </h2>
            {os.dataSaida ? (
              <dl className="space-y-3">
                <Dado rotulo="Data e hora">{dataHora(os.dataSaida)}</Dado>
                <Dado rotulo="Entregue por">
                  <span className="font-semibold">{nomeFuncionario(os.funcionarioSaidaId)}</span>
                </Dado>
                <Dado rotulo="Retirado por">
                  {os.clienteRetirou ?? "—"}
                  {os.documentoRetirada && (
                    <span className="block text-xs text-carvao-500">
                      Doc. {os.documentoRetirada}
                    </span>
                  )}
                </Dado>
                <Dado rotulo="KM">
                  {os.kmSaida ? os.kmSaida.toLocaleString("pt-BR") : "—"}
                </Dado>
                {os.observacoesSaida && (
                  <Dado rotulo="Observações">
                    <span className="whitespace-pre-wrap">{os.observacoesSaida}</span>
                  </Dado>
                )}
                {os.assinaturaEntrega && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                      Assinatura de recebimento
                    </dt>
                    <dd className="mt-1">
                      <img src={os.assinaturaEntrega}
                        alt={`Assinatura de ${os.clienteRetirou ?? cliente.nome}`}
                        className="h-20 w-full rounded-md border border-carvao-200 bg-white object-contain p-1" />
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-carvao-500">
                Veículo ainda na oficina. A saída é registrada no painel ao lado.
              </p>
            )}
          </Cartao>

          {comissoes.length > 0 && (
            <Cartao className="p-5">
              <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
                Comissões
              </h2>
              <ul className="space-y-2 text-sm">
                {comissoes.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="text-carvao-700">
                      {nomeFuncionario(c.funcionarioId)}
                      <span className="block text-xs text-carvao-500">
                        {num(c.percentual)}% de {brl(c.baseCalculo)}
                      </span>
                    </span>
                    <span className="font-bold text-carvao-950">{brl(c.valor)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
