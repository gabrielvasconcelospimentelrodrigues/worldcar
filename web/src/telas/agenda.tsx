import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban, Calendar, CheckCircle2, ChevronLeft, ChevronRight, LogIn, Phone,
} from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Campo, Cartao, Indicador, Selecao,
  TituloPagina,
} from "@/componentes/ui";
import { brl, telefone as fmtTelefone, numeroDoc, placa as fmtPlaca } from "@/lib/format";
import { useEquipe } from "@/lib/equipe";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Agenda do dia.
 *
 * O dia e a unidade certa aqui, nao a semana nem o mes: quem abre esta tela
 * quer saber quem chega hoje e o que falta confirmar. Semana inteira numa grade
 * fica bonita e nao responde nenhuma das duas perguntas.
 *
 * Agendamento vindo do site nasce PENDENTE de proposito — alguem confirma antes
 * de o horario valer. E quando o cliente chega, um botao transforma o
 * agendamento em ordem de servico, casando cliente e veiculo com o cadastro.
 */

type Agendamento = {
  id: string;
  numero: number;
  status: "PENDENTE" | "CONFIRMADO" | "CANCELADO" | "COMPARECEU" | "FALTOU";
  origem: "SITE" | "INTERNO";
  inicio: string;
  fim: string;
  setor: string;
  nome: string;
  telefone: string;
  placa: string | null;
  veiculoDesc: string | null;
  observacoes: string | null;
  ordemId: string | null;
  valorCobrado: string | null;
  motivoCancelamento: string | null;
  servicos: { nome: string; preco: string } | null;
  pagamentos_online: { status: string; valor: string }[] | null;
};

const STATUS: Record<Agendamento["status"], { cor: string; label: string }> = {
  PENDENTE:   { cor: "bg-amber-100 text-amber-800",     label: "Aguardando confirmação" },
  CONFIRMADO: { cor: "bg-emerald-100 text-emerald-800", label: "Confirmado" },
  COMPARECEU: { cor: "bg-sky-100 text-sky-800",         label: "Compareceu" },
  FALTOU:     { cor: "bg-marca-100 text-marca-700",     label: "Faltou" },
  CANCELADO:  { cor: "bg-carvao-200 text-carvao-600",   label: "Cancelado" },
};

const p2 = (n: number) => String(n).padStart(2, "0");
const paraInput = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function Agenda() {
  const { ativos } = useEquipe();
  const [dia, setDia] = useState(() => paraInput(new Date()));
  const [linhas, setLinhas] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [chegando, setChegando] = useState<string | null>(null);
  const [funcionario, setFuncionario] = useState("");
  const [km, setKm] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    // O dia vai de 00:00 a 00:00 do seguinte, no relógio de quem está olhando.
    const ini = new Date(`${dia}T00:00:00`);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 1);

    const { data, error } = await sb
      .from("agendamentos")
      .select("*, servicos(nome, preco), pagamentos_online(status, valor)")
      .gte("inicio", ini.toISOString())
      .lt("inicio", fim.toISOString())
      .order("inicio");

    setErro(error ? mensagemErro(error) : null);
    setLinhas((data as unknown as Agendamento[]) ?? []);
    setCarregando(false);
  }, [dia]);

  useEffect(() => { void carregar(); }, [carregar]);

  function mover(dias: number) {
    const d = new Date(`${dia}T12:00:00`);
    d.setDate(d.getDate() + dias);
    setDia(paraInput(d));
  }

  async function confirmar(id: string) {
    setOcupado(true); setErro(null); setOk(null);
    const { error } = await sb.rpc("confirmar_agendamento", { p_id: id });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setOk("Agendamento confirmado.");
    await carregar();
  }

  async function cancelar(id: string) {
    if (!motivo.trim()) return setErro("Diga o motivo do cancelamento.");
    setOcupado(true); setErro(null); setOk(null);
    const { error } = await sb.rpc("cancelar_agendamento", {
      p_id: id, p_motivo: motivo.trim(),
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setCancelando(null); setMotivo("");
    setOk("Agendamento cancelado e horário liberado.");
    await carregar();
  }

  async function chegou(id: string) {
    if (!funcionario) return setErro("Diga quem está recebendo o veículo.");
    setOcupado(true); setErro(null); setOk(null);
    const { data, error } = await sb.rpc("converter_agendamento", {
      p_id: id,
      p_funcionario_entrada: funcionario,
      p_km_entrada: Number(km.replace(/\D/g, "")) || null,
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const r = data as { numero: number; clienteNovo: boolean; veiculoNovo: boolean };
    setChegando(null); setKm("");
    setOk(
      `OS ${numeroDoc(r.numero)} aberta.` +
      (r.clienteNovo ? " Cliente cadastrado agora." : "") +
      (r.veiculoNovo ? " Veículo cadastrado agora." : ""),
    );
    await carregar();
  }

  const pendentes = linhas.filter((l) => l.status === "PENDENTE").length;
  const confirmados = linhas.filter((l) => l.status === "CONFIRMADO").length;
  const previsto = linhas
    .filter((l) => !["CANCELADO", "FALTOU"].includes(l.status))
    .reduce((s, l) => s + Number(l.servicos?.preco ?? 0), 0);

  const ehHoje = dia === paraInput(new Date());

  return (
    <>
      <TituloPagina
        titulo="Agenda"
        descricao="Quem chega hoje, o que falta confirmar e o que já foi pago."
        acao={
          <div className="flex items-end gap-2">
            <div className="flex items-center rounded-md border border-carvao-300 bg-white">
              <button type="button" onClick={() => mover(-1)} aria-label="Dia anterior"
                className="px-2.5 py-2 text-carvao-600 hover:text-marca-600">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)}
                aria-label="Dia da agenda"
                className="border-x border-carvao-200 px-2 py-2 text-sm text-carvao-950 focus:outline-none" />
              <button type="button" onClick={() => mover(1)} aria-label="Próximo dia"
                className="px-2.5 py-2 text-carvao-600 hover:text-marca-600">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {!ehHoje && (
              <Botao type="button" variante="fantasma"
                onClick={() => setDia(paraInput(new Date()))} className="px-3 py-2 text-xs">
                Hoje
              </Botao>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Agendamentos no dia" valor={String(linhas.length)}
          icone={<Calendar className="h-5 w-5" aria-hidden />} />
        <Indicador rotulo="Aguardando confirmação" valor={String(pendentes)}
          destaque={pendentes > 0} />
        <Indicador rotulo="Confirmados" valor={String(confirmados)} />
        <Indicador rotulo="Previsto no dia" valor={brl(previsto)}
          detalhe="Soma dos serviços marcados" />
      </div>

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      <Cartao>
        <CabecalhoCartao
          titulo={new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "long", day: "2-digit", month: "long",
          })}
          descricao={linhas.length === 0 ? undefined : `${linhas.length} horário(s)`}
        />

        {carregando ? (
          <p className="px-5 py-10 text-center text-sm text-carvao-500">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-carvao-500">
            Nenhum agendamento neste dia.
          </p>
        ) : (
          <ul className="divide-y divide-carvao-100">
            {linhas.map((l) => {
              const pago = (l.pagamentos_online ?? []).find((p) => p.status === "PAGO");
              const rotulo = STATUS[l.status];
              const encerrado = ["CANCELADO", "COMPARECEU", "FALTOU"].includes(l.status);

              return (
                <li key={l.id} className="p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    {/* A hora precisa ser a primeira coisa lida: a pergunta da
                        agenda é sempre "o que vem agora". */}
                    <div className="w-16 shrink-0">
                      <p className="font-display text-xl font-extrabold text-carvao-950">
                        {hora(l.inicio)}
                      </p>
                      <p className="text-xs text-carvao-500">até {hora(l.fim)}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-carvao-950">{l.nome}</p>
                        <Badge cor={rotulo.cor}>{rotulo.label}</Badge>
                        {l.origem === "SITE" && (
                          <Badge cor="bg-carvao-100 text-carvao-600">pelo site</Badge>
                        )}
                        {pago && (
                          <Badge cor="bg-emerald-100 text-emerald-800">
                            {brl(pago.valor)} pago
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-carvao-700">
                        {l.servicos?.nome ?? "—"}
                        {l.servicos && ` · ${brl(l.servicos.preco)}`}
                      </p>

                      <p className="mt-0.5 text-xs text-carvao-500">
                        <a href={`tel:${l.telefone}`} className="hover:text-marca-600">
                          <Phone className="mr-1 inline h-3 w-3" aria-hidden />
                          {fmtTelefone(l.telefone)}
                        </a>
                        {l.placa && ` · ${fmtPlaca(l.placa)}`}
                        {l.veiculoDesc && ` · ${l.veiculoDesc}`}
                      </p>

                      {l.observacoes && (
                        <p className="mt-1 text-xs italic text-carvao-500">
                          "{l.observacoes}"
                        </p>
                      )}
                      {l.motivoCancelamento && (
                        <p className="mt-1 text-xs text-marca-600">
                          {l.motivoCancelamento}
                        </p>
                      )}
                      {l.ordemId && (
                        <Link to={`/sistema/ordens/${l.ordemId}`}
                          className="mt-1 inline-block text-xs font-semibold text-marca-600 hover:underline">
                          Abrir a ordem de serviço
                        </Link>
                      )}
                    </div>

                    {!encerrado && (
                      <div className="flex flex-wrap gap-2">
                        {l.status === "PENDENTE" && (
                          <Botao type="button" disabled={ocupado}
                            onClick={() => void confirmar(l.id)}
                            className="px-3 py-1.5 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Confirmar
                          </Botao>
                        )}
                        <Botao type="button" variante="fantasma" disabled={ocupado}
                          onClick={() => { setChegando(l.id); setCancelando(null); }}
                          className="px-3 py-1.5 text-xs">
                          <LogIn className="h-3.5 w-3.5" aria-hidden />
                          Chegou
                        </Botao>
                        <button type="button" disabled={ocupado}
                          onClick={() => { setCancelando(l.id); setChegando(null); }}
                          className="rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                          aria-label={`Cancelar agendamento de ${l.nome}`}>
                          <Ban className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>

                  {chegando === l.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-carvao-200 bg-carvao-50 p-4">
                      <Selecao rotulo="Quem recebeu" value={funcionario} className="w-52"
                        onChange={(e) => setFuncionario(e.target.value)}>
                        <option value="">Selecione...</option>
                        {ativos.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </Selecao>
                      <Campo rotulo="KM de entrada" value={km} className="w-36"
                        inputMode="numeric"
                        onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
                      <div className="flex items-center gap-2 pb-0.5">
                        <Botao type="button" disabled={ocupado}
                          onClick={() => void chegou(l.id)}>
                          Abrir OS
                        </Botao>
                        <button type="button" onClick={() => setChegando(null)}
                          className="px-2 text-sm font-semibold text-carvao-500 hover:text-carvao-900">
                          Cancelar
                        </button>
                      </div>
                      <p className="w-full text-xs text-carvao-500">
                        Cliente e veículo entram no cadastro se ainda não existirem, e o
                        que já foi pago no agendamento vira sinal da OS.
                      </p>
                    </div>
                  )}

                  {cancelando === l.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-marca-200 bg-marca-50 p-4">
                      <Campo rotulo="Motivo do cancelamento" value={motivo}
                        className="min-w-64 flex-1"
                        placeholder="Cliente desmarcou, chuva, falta de peça..."
                        onChange={(e) => setMotivo(e.target.value)} />
                      <div className="flex items-center gap-2 pb-0.5">
                        <Botao type="button" disabled={ocupado}
                          onClick={() => void cancelar(l.id)}>
                          Cancelar agendamento
                        </Botao>
                        <button type="button"
                          onClick={() => { setCancelando(null); setMotivo(""); }}
                          className="px-2 text-sm font-semibold text-carvao-500 hover:text-carvao-900">
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}
