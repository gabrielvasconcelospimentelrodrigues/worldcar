import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, Check, FileText, MessageCircle, Pencil, Send, Undo2, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, BotaoLink, Campo, Cartao, CabecalhoCartao,
  Dado, Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { NIVEIS_COMBUSTIVEL, STATUS_ORCAMENTO } from "@/lib/constantes";
import {
  brl, data, fimDoExpediente, linkWhatsapp, num, numeroDoc, paraInputDataHora, telefone,
} from "@/lib/format";
import { agora, equipeAtiva } from "@/lib/consultas";
import { mensagemErro, sb } from "@/lib/supabase";
import type {
  Cliente, MembroEquipe, Orcamento, OrcamentoItem, Servico, Veiculo,
} from "@/lib/tipos";
import { reservarAba } from "@/pdf/aba";

type ItemComServico = OrcamentoItem & { servicos: Pick<Servico, "descricao" | "garantiaDias"> | null };

export function FichaOrcamento() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();

  const [orc, setOrc] = useState<Orcamento | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<ItemComServico[]>([]);
  const [vendedor, setVendedor] = useState<string | null>(null);
  const [osGerada, setOsGerada] = useState<{ id: string; numero: number } | null>(null);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [o, its, eq] = await Promise.all([
      sb.from("orcamentos").select("*").eq("id", id).maybeSingle(),
      sb.from("orcamento_itens")
        .select("*, servicos(descricao, garantiaDias)")
        .eq("orcamentoId", id).order("ordem"),
      equipeAtiva(),
    ]);

    const oo = o.data as Orcamento | null;
    setOrc(oo);
    setItens((its.data as ItemComServico[]) ?? []);
    setEquipe(eq);

    if (oo) {
      const [c, v, os] = await Promise.all([
        sb.from("clientes").select("*").eq("id", oo.clienteId).maybeSingle(),
        sb.from("veiculos").select("*").eq("id", oo.veiculoId).maybeSingle(),
        sb.from("ordens_servico").select("id, numero").eq("orcamentoId", oo.id).maybeSingle(),
      ]);
      setCliente(c.data as Cliente);
      setVeiculo(v.data as Veiculo);
      setOsGerada((os.data as { id: string; numero: number }) ?? null);
      setVendedor(eq.find((f) => f.id === oo.vendedorId)?.nome ?? null);
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function mudarStatus(status: string, motivo?: string) {
    if (!id) return;
    setOcupado(true);
    setErro(null);
    const { error } = await sb.from("orcamentos").update({
      status,
      aprovadoEm: status === "APROVADO" ? agora() : null,
      motivoRecusa: status === "RECUSADO" ? (motivo?.trim() || null) : null,
      atualizadoEm: agora(),
    }).eq("id", id);
    setOcupado(false);
    setRecusando(false);
    if (error) return setErro(mensagemErro(error));
    await carregar();
  }

  async function converter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    setOcupado(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const previsao = String(f.get("previsao") ?? "");

    // A conversao roda inteira no banco: cria a OS, copia os itens com as
    // garantias e marca o orcamento como convertido, tudo numa transacao.
    const { data: novoOsId, error } = await sb.rpc("converter_orcamento", {
      p_orcamento_id: id,
      p_funcionario_entrada: String(f.get("funcionarioEntradaId") ?? ""),
      p_km_entrada: Number(String(f.get("kmEntrada") ?? "").replace(/\D/g, "")) || null,
      p_combustivel: String(f.get("combustivel") ?? "") || null,
      // O campo ja traz a hora combinada; a hora fixa de antes fazia toda OS
      // nascer prometida para as 18h.
      p_previsao: previsao ? new Date(previsao).toISOString() : null,
    });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    navegar(`/sistema/ordens/${novoOsId as string}`);
  }

  async function gerarPdf(baixar: boolean, aba: Window | null) {
    if (!orc || !cliente || !veiculo) return;
    setGerandoPdf(true);
    setErro(null);
    try {
      // Carregado so agora: o @react-pdf/renderer sozinho pesa mais de 1 MB,
      // e ninguem deveria pagar isso na abertura do sistema.
      const { baixarPdfOrcamento } = await import("@/pdf/gerar");
      await baixarPdfOrcamento({ orc, cliente, veiculo, itens, vendedor }, baixar, aba);
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
  if (!orc || !cliente || !veiculo) {
    return <Aviso tipo="erro">Orçamento não encontrado.</Aviso>;
  }

  const rotulo = STATUS_ORCAMENTO[orc.status];
  const zap = `Olá ${cliente.nome.split(" ")[0]}! Segue o orçamento ${numeroDoc(orc.numero)} da World Car Service para o ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}): ${brl(orc.total)}. Válido até ${data(orc.validoAte)}.`;

  return (
    <>
      <TituloPagina
        titulo={`Orçamento ${numeroDoc(orc.numero)}`}
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
              Enviar
            </a>
            {orc.status !== "CONVERTIDO" && (
              <BotaoLink to={`/sistema/orcamentos/${orc.id}/editar`} variante="fantasma">
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </BotaoLink>
            )}
          </>
        }
      />

      {osGerada && (
        <div className="mb-4">
          <Aviso tipo="sucesso">
            Este orçamento virou a{" "}
            <Link to={`/sistema/ordens/${osGerada.id}`} className="inline-flex items-center gap-1 font-semibold underline">
              OS {numeroDoc(osGerada.numero)}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>.
          </Aviso>
        </div>
      )}

      {orc.status === "RECUSADO" && orc.motivoRecusa && (
        <div className="mb-4">
          <Aviso tipo="erro"><strong>Motivo da recusa:</strong> {orc.motivoRecusa}</Aviso>
        </div>
      )}

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Serviços orçados"
              acao={<Badge cor={rotulo.cor}>{rotulo.label}</Badge>} />
            <Tabela>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th className="text-center">Garantia</Th>
                  <Th className="text-center">Qtd</Th>
                  <Th className="text-right">Valor un.</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <p className="font-medium text-carvao-950">{i.descricao}</p>
                      {i.servicos?.descricao && (
                        <p className="mt-0.5 text-xs text-carvao-500">{i.servicos.descricao}</p>
                      )}
                    </Td>
                    <Td className="text-center text-carvao-600">
                      {i.servicos?.garantiaDias ? `${i.servicos.garantiaDias}d` : "—"}
                    </Td>
                    <Td className="text-center">{num(i.quantidade)}</Td>
                    <Td className="text-right">{brl(i.precoUnit)}</Td>
                    <Td className="text-right font-semibold">{brl(i.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>

            <dl className="flex flex-col items-end gap-1 border-t border-carvao-200 bg-carvao-50 p-5 text-sm">
              <div className="flex w-56 justify-between">
                <dt className="text-carvao-600">Subtotal</dt>
                <dd className="font-medium">{brl(orc.subtotal)}</dd>
              </div>
              <div className="flex w-56 justify-between">
                <dt className="text-carvao-600">
                  Desconto{orc.descontoTipo === "PERCENTUAL" ? ` (${num(orc.desconto)}%)` : ""}
                </dt>
                <dd className="font-medium text-marca-600">
                  − {brl(num(orc.subtotal) - num(orc.total))}
                </dd>
              </div>
              <div className="mt-1 flex w-56 items-center justify-between border-t border-carvao-300 pt-2">
                <dt className="font-bold uppercase text-carvao-950">Total</dt>
                <dd className="font-display text-2xl font-extrabold text-carvao-950">{brl(orc.total)}</dd>
              </div>
            </dl>
          </Cartao>

          {orc.status !== "CONVERTIDO" && (
            <Cartao>
              <CabecalhoCartao titulo="Ações" />
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  {(orc.status === "RASCUNHO" || orc.status === "EXPIRADO") && (
                    <Botao type="button" variante="secundario" disabled={ocupado}
                      onClick={() => void mudarStatus("ENVIADO")}>
                      <Send className="h-4 w-4" aria-hidden />
                      Marcar como enviado
                    </Botao>
                  )}
                  {orc.status !== "APROVADO" && orc.status !== "RECUSADO" && (
                    <Botao type="button" disabled={ocupado} onClick={() => void mudarStatus("APROVADO")}>
                      <Check className="h-4 w-4" aria-hidden />
                      Cliente aprovou
                    </Botao>
                  )}
                  {orc.status !== "RECUSADO" && (
                    <Botao type="button" variante="perigo" onClick={() => setRecusando((v) => !v)}>
                      <X className="h-4 w-4" aria-hidden />
                      Cliente recusou
                    </Botao>
                  )}
                  {(orc.status === "APROVADO" || orc.status === "RECUSADO") && (
                    <Botao type="button" variante="fantasma" disabled={ocupado}
                      onClick={() => void mudarStatus("ENVIADO")}>
                      <Undo2 className="h-4 w-4" aria-hidden />
                      Reabrir
                    </Botao>
                  )}
                  {orc.status === "APROVADO" && (
                    <Botao type="button" variante="secundario" onClick={() => setConvertendo((v) => !v)}>
                      Gerar ordem de serviço
                    </Botao>
                  )}
                </div>

                {recusando && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void mudarStatus("RECUSADO", String(f.get("motivo") ?? ""));
                    }}
                    className="space-y-3 rounded-md border border-marca-200 bg-marca-50 p-4"
                  >
                    <AreaTexto rotulo="Motivo da recusa" name="motivo" rows={2}
                      placeholder="Preço, prazo, foi em outro lugar..." />
                    <div className="flex gap-2">
                      <Botao type="submit" variante="perigo" disabled={ocupado}>Confirmar recusa</Botao>
                      <Botao type="button" variante="fantasma" onClick={() => setRecusando(false)}>
                        Cancelar
                      </Botao>
                    </div>
                  </form>
                )}

                {convertendo && (
                  <form onSubmit={converter} className="space-y-4 rounded-md border border-carvao-300 bg-carvao-50 p-4">
                    <div>
                      <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                        Entrada do veículo
                      </h3>
                      <p className="mt-0.5 text-sm text-carvao-600">
                        Registre quem está recebendo o veículo. A OS nasce com estes dados.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Selecao rotulo="Funcionário que recebeu" name="funcionarioEntradaId" required>
                        <option value="">Selecione...</option>
                        {equipe.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                        ))}
                      </Selecao>
                      <Campo rotulo="Previsão de entrega" name="previsao"
                        type="datetime-local" defaultValue={fimDoExpediente(1)}
                        min={paraInputDataHora(new Date())}
                        dica="Data e hora combinadas com o cliente" />
                      <Campo rotulo="KM na entrada" name="kmEntrada" type="number" min={0}
                        defaultValue={orc.kmVeiculo ?? veiculo.km ?? ""} />
                      <Selecao rotulo="Nível de combustível" name="combustivel">
                        <option value="">Não informado</option>
                        {NIVEIS_COMBUSTIVEL.map((n) => <option key={n} value={n}>{n}</option>)}
                      </Selecao>
                    </div>
                    <div className="flex gap-2">
                      <Botao type="submit" disabled={ocupado}>Abrir ordem de serviço</Botao>
                      <Botao type="button" variante="fantasma" onClick={() => setConvertendo(false)}>
                        Cancelar
                      </Botao>
                    </div>
                  </form>
                )}
              </div>
            </Cartao>
          )}
        </div>

        <Cartao className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
            Dados do documento
          </h2>
          <dl className="space-y-3">
            <Dado rotulo="Cliente">
              <Link to={`/sistema/clientes/${cliente.id}`} className="font-semibold text-marca-600 hover:underline">
                {cliente.nome}
              </Link>
            </Dado>
            <Dado rotulo="Telefone">{telefone(cliente.telefone)}</Dado>
            <Dado rotulo="Veículo">
              {veiculo.marca} {veiculo.modelo}{veiculo.ano ? ` ${veiculo.ano}` : ""} · {veiculo.placa}
            </Dado>
            <Dado rotulo="KM">{orc.kmVeiculo ? orc.kmVeiculo.toLocaleString("pt-BR") : "—"}</Dado>
            <Dado rotulo="Emitido em">{data(orc.criadoEm)}</Dado>
            <Dado rotulo="Válido até">{data(orc.validoAte)}</Dado>
            <Dado rotulo="Prazo de execução">
              {orc.prazoEntregaDias ? `${orc.prazoEntregaDias} dia(s) útil(eis)` : "A combinar"}
            </Dado>
            <Dado rotulo="Forma de pagamento">{orc.formaPagamento ?? "A combinar"}</Dado>
            <Dado rotulo="Vendedor">{vendedor ?? "—"}</Dado>
          </dl>

          {orc.observacoes && (
            <div className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">Observações</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">{orc.observacoes}</p>
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
