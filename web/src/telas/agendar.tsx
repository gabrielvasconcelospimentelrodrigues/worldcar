import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Calendar, CheckCircle2, ChevronRight, Clock, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/componentes/logo";
import { EMPRESA, whatsappLink } from "@/lib/empresa-info";
import { brl } from "@/lib/format";
import { mascararPlaca, mascararTelefone, soDigitos } from "@/lib/mascaras";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Autoatendimento: o cliente marca o horario sozinho, pelo site.
 *
 * Tres passos, um por tela, e nao um formulario unico. Quem esta no celular no
 * semaforo nao preenche oito campos; escolher servico, escolher horario e
 * digitar nome e telefone sao decisoes pequenas, tomadas uma de cada vez.
 *
 * Nada aqui decide se o horario esta livre — quem decide e o banco, na hora de
 * gravar. Dois visitantes veem a mesma vaga na tela; se a decisao fosse daqui,
 * os dois marcariam o mesmo horario.
 */

type ServicoAgendavel = {
  id: string; nome: string; categoria: string; preco: number;
  duracaoMin: number; descricao: string | null; garantiaDias: number;
};

type Vaga = { inicio: string; fim: string; hora: string; vagas: number };

type Disponibilidade = {
  erro?: string;
  servico?: string;
  horarios: Vaga[];
};

const CATEGORIA: Record<string, string> = {
  LAVAGEM: "Lavagem",
  ESTETICA: "Estética",
  REVITALIZACAO: "Revitalização",
  VITRIFICACAO: "Vitrificação",
  PELICULA: "Películas",
};

const p2 = (n: number) => String(n).padStart(2, "0");
const paraInput = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Os proximos 14 dias. Mais que isso vira rolagem sem ninguem usar. */
function proximosDias() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function Agendar() {
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(1);
  const [servicos, setServicos] = useState<ServicoAgendavel[]>([]);
  const [escolhido, setEscolhido] = useState<ServicoAgendavel | null>(null);
  const [dia, setDia] = useState(() => paraInput(new Date()));
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [vaga, setVaga] = useState<Vaga | null>(null);

  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [placa, setPlaca] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [obs, setObs] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ numero: number; data: string; hora: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("servicos_agendaveis");
      setErro(error ? mensagemErro(error) : null);
      setServicos((data as ServicoAgendavel[]) ?? []);
      setCarregando(false);
    })();
  }, []);

  useEffect(() => {
    if (!escolhido || passo !== 2) return;
    let vivo = true;
    (async () => {
      setBuscando(true);
      setVaga(null);
      const { data, error } = await sb.rpc("horarios_disponiveis", {
        p_servico_id: escolhido.id, p_data: dia,
      });
      if (!vivo) return;
      setErro(error ? mensagemErro(error) : null);
      setDisp((data as Disponibilidade) ?? null);
      setBuscando(false);
    })();
    return () => { vivo = false; };
  }, [escolhido, dia, passo]);

  async function confirmar() {
    if (!escolhido || !vaga) return;
    if (!nome.trim()) return setErro("Diga o seu nome.");
    if (soDigitos(tel).length < 10) return setErro("Informe o telefone com DDD.");

    setEnviando(true);
    setErro(null);
    const { data, error } = await sb.rpc("agendar_publico", {
      p_servico_id: escolhido.id,
      p_inicio: vaga.inicio,
      p_nome: nome.trim(),
      p_telefone: soDigitos(tel),
      p_placa: placa || null,
      p_veiculo: veiculo.trim() || null,
      p_observacoes: obs.trim() || null,
    });
    setEnviando(false);
    if (error) {
      // Erro mais comum: alguém pegou a vaga no meio do caminho. A mensagem vem
      // pronta do banco, e o cliente volta para a escolha de horário.
      setErro(mensagemErro(error));
      setPasso(2);
      return;
    }
    const r = data as { numero: number; data: string; hora: string };
    setFeito(r);
    setPasso(4);
  }

  const grupos = new Map<string, ServicoAgendavel[]>();
  for (const s of servicos) {
    if (!grupos.has(s.categoria)) grupos.set(s.categoria, []);
    grupos.get(s.categoria)!.push(s);
  }

  return (
    <div className="min-h-screen bg-carvao-50">
      <header className="border-b border-carvao-800 bg-carvao-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label={`${EMPRESA.nome} — página inicial`}>
            <Logo tamanho="sm" invertido />
          </Link>
          <Link to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-carvao-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* ------------------------------------------------ passos */}
        {passo < 4 && (
          <nav aria-label="Etapas do agendamento" className="mb-8 flex items-center gap-2">
            {[
              { n: 1, r: "Serviço" },
              { n: 2, r: "Horário" },
              { n: 3, r: "Seus dados" },
            ].map((e, i) => (
              <div key={e.n} className="flex flex-1 items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  passo >= e.n ? "bg-marca-500 text-white" : "bg-carvao-200 text-carvao-500"}`}>
                  {e.n}
                </span>
                <span className={`text-sm font-semibold ${
                  passo >= e.n ? "text-carvao-950" : "text-carvao-400"}`}>
                  {e.r}
                </span>
                {i < 2 && <span className="h-px flex-1 bg-carvao-200" aria-hidden />}
              </div>
            ))}
          </nav>
        )}

        {erro && (
          <div className="mb-6 rounded-md border border-marca-300 bg-marca-50 p-4 text-sm text-marca-700">
            {erro}
          </div>
        )}

        {/* ------------------------------------------------ 1. serviço */}
        {passo === 1 && (
          <>
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950">
              O que o seu carro precisa?
            </h1>
            <p className="mt-2 text-carvao-600">
              Escolha o serviço e veja os horários livres. Funilaria e pintura são
              orçadas com o carro na mão —{" "}
              <a href={whatsappLink("Olá! Gostaria de avaliar um serviço de funilaria ou pintura.")}
                target="_blank" rel="noopener noreferrer"
                className="font-semibold text-marca-600 hover:underline">
                fale com a gente
              </a>.
            </p>

            {carregando ? (
              <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>
            ) : (
              <div className="mt-8 space-y-8">
                {[...grupos.entries()].map(([cat, lista]) => (
                  <section key={cat}>
                    <h2 className="mb-3 border-l-4 border-marca-500 pl-3 font-display text-xl font-bold uppercase tracking-tight text-carvao-950">
                      {CATEGORIA[cat] ?? cat}
                    </h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {lista.map((s) => (
                        <li key={s.id}>
                          <button type="button"
                            onClick={() => { setEscolhido(s); setPasso(2); setErro(null); }}
                            className="flex w-full items-center gap-3 rounded-lg border border-carvao-200 bg-white p-4 text-left transition hover:border-marca-500 hover:shadow-md">
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-carvao-950">
                                {s.nome}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-carvao-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  {s.duracaoMin >= 60
                                    ? `${Math.round((s.duracaoMin / 60) * 10) / 10}h`
                                    : `${s.duracaoMin} min`}
                                </span>
                                {s.garantiaDias > 0 && (
                                  <span className="flex items-center gap-1 text-emerald-700">
                                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                                    {s.garantiaDias}d de garantia
                                  </span>
                                )}
                              </span>
                              <span className="mt-1.5 block font-display text-lg font-extrabold text-carvao-950">
                                {brl(s.preco)}
                              </span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-carvao-300" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------ 2. horário */}
        {passo === 2 && escolhido && (
          <>
            <button type="button" onClick={() => { setPasso(1); setErro(null); }}
              className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-carvao-500 hover:text-marca-600">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Trocar de serviço
            </button>

            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950">
              Quando fica bom?
            </h1>
            <p className="mt-2 text-carvao-600">
              {escolhido.nome} · {brl(escolhido.preco)} ·{" "}
              {escolhido.duracaoMin >= 60
                ? `${Math.round((escolhido.duracaoMin / 60) * 10) / 10} hora(s)`
                : `${escolhido.duracaoMin} minutos`}
            </p>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {proximosDias().map((d) => {
                const v = paraInput(d);
                const hoje = v === paraInput(new Date());
                return (
                  <button key={v} type="button" onClick={() => setDia(v)}
                    className={`flex min-w-[68px] shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition ${
                      dia === v
                        ? "border-marca-500 bg-marca-500 text-white"
                        : "border-carvao-200 bg-white text-carvao-700 hover:border-carvao-400"}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      {hoje ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                    </span>
                    <span className="font-display text-lg font-extrabold">{d.getDate()}</span>
                    <span className="text-[10px]">
                      {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-lg border border-carvao-200 bg-white p-5">
              {buscando ? (
                <p className="py-8 text-center text-sm text-carvao-500">
                  Procurando horários...
                </p>
              ) : disp?.erro ? (
                <p className="py-8 text-center text-sm text-carvao-500">
                  {disp.erro === "fechado neste dia"
                    ? "Estamos fechados neste dia. Escolha outro."
                    : disp.erro}
                </p>
              ) : !disp?.horarios.length ? (
                <p className="py-8 text-center text-sm text-carvao-500">
                  Nenhum horário livre neste dia. Tente o próximo.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-carvao-500">
                    {disp.horarios.length} horário(s) livre(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {disp.horarios.map((h) => (
                      <button key={h.inicio} type="button"
                        onClick={() => { setVaga(h); setPasso(3); setErro(null); }}
                        className="rounded-md border border-carvao-300 bg-white px-4 py-2.5 font-semibold text-carvao-800 transition hover:border-marca-500 hover:bg-marca-50 hover:text-marca-700">
                        {h.hora}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ------------------------------------------------ 3. dados */}
        {passo === 3 && escolhido && vaga && (
          <>
            <button type="button" onClick={() => { setPasso(2); setErro(null); }}
              className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-carvao-500 hover:text-marca-600">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Trocar de horário
            </button>

            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950">
              Quase lá
            </h1>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-marca-200 bg-marca-50 p-4">
              <Calendar className="h-5 w-5 shrink-0 text-marca-600" aria-hidden />
              <p className="text-sm text-carvao-800">
                <strong>{escolhido.nome}</strong> em{" "}
                {new Date(vaga.inicio).toLocaleDateString("pt-BR", {
                  weekday: "long", day: "2-digit", month: "long",
                })}{" "}
                às <strong>{vaga.hora}</strong> · {brl(escolhido.preco)}
              </p>
            </div>

            <form className="mt-6 space-y-4"
              onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                    Seu nome *
                  </span>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} required
                    className="w-full rounded-md border border-carvao-300 bg-white px-3 py-2.5 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                    WhatsApp *
                  </span>
                  <input value={tel} inputMode="tel" required
                    placeholder="(41) 99999-0000"
                    onChange={(e) => setTel(mascararTelefone(e.target.value))}
                    className="w-full rounded-md border border-carvao-300 bg-white px-3 py-2.5 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                    Placa
                  </span>
                  <input value={placa} placeholder="ABC1D23"
                    onChange={(e) => setPlaca(mascararPlaca(e.target.value))}
                    className="w-full rounded-md border border-carvao-300 bg-white px-3 py-2.5 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                    Carro
                  </span>
                  <input value={veiculo} placeholder="Fiat Argo 2021"
                    onChange={(e) => setVeiculo(e.target.value)}
                    className="w-full rounded-md border border-carvao-300 bg-white px-3 py-2.5 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                  Alguma observação?
                </span>
                <textarea value={obs} rows={2}
                  placeholder="Algo que a gente precisa saber sobre o carro..."
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full rounded-md border border-carvao-300 bg-white px-3 py-2.5 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
              </label>

              <button type="submit" disabled={enviando}
                className="w-full rounded-md bg-marca-500 px-6 py-3.5 font-display text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-600 disabled:opacity-60">
                {enviando ? "Enviando..." : "Confirmar agendamento"}
              </button>

              <p className="text-center text-xs text-carvao-500">
                Seu horário fica reservado e a gente confirma pelo WhatsApp.
              </p>
            </form>
          </>
        )}

        {/* ------------------------------------------------ 4. pronto */}
        {passo === 4 && feito && (
          <div className="rounded-xl border border-carvao-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden />
            <h1 className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950">
              Horário reservado
            </h1>
            <p className="mt-2 text-carvao-600">
              Agendamento <strong>#{feito.numero}</strong> — {feito.data} às{" "}
              <strong>{feito.hora}</strong>
            </p>

            {/* A pessoa acabou de confiar um horário a um site. Dizer o que
                acontece agora evita a dúvida de "será que deu certo?". */}
            <p className="mx-auto mt-4 max-w-md text-sm text-carvao-500">
              Vamos confirmar pelo WhatsApp em instantes. Se precisar remarcar ou
              cancelar, é só nos chamar.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href={whatsappLink(
                `Olá! Acabei de agendar pelo site — agendamento #${feito.numero}, ${feito.data} às ${feito.hora}.`)}
                target="_blank" rel="noopener noreferrer"
                className="rounded-md bg-marca-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-marca-600">
                Falar no WhatsApp
              </a>
              <Link to="/"
                className="rounded-md border border-carvao-300 px-5 py-2.5 text-sm font-semibold text-carvao-700 transition hover:border-carvao-500">
                Voltar ao site
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
