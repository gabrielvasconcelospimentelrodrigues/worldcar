import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import {
  DIFERENCIAIS,
  EMPRESA,
  SERVICOS_VITRINE,
  enderecoCompleto,
  whatsappLink,
} from "@/lib/empresa-info";
import { IconeInstagram } from "@/components/site/icone-instagram";

const MSG_PADRAO = `Olá! Vim pelo site da ${EMPRESA.nome} e gostaria de um orçamento.`;

const NAV = [
  { href: "#servicos", label: "Serviços" },
  { href: "#processo", label: "Como funciona" },
  { href: "#diferenciais", label: "Diferenciais" },
  { href: "#contato", label: "Contato" },
];

const PROCESSO = [
  {
    icone: ClipboardCheck,
    titulo: "1. Orçamento",
    texto:
      "Avaliamos o veículo e emitimos um orçamento formal em PDF, com valores, prazo e garantia de cada serviço.",
  },
  {
    icone: Sparkles,
    titulo: "2. Vistoria de entrada",
    texto:
      "Na chegada, registramos o estado do carro item por item, com fotos. Você recebe uma via desse laudo.",
  },
  {
    icone: Clock,
    titulo: "3. Execução",
    texto:
      "Cada serviço tem um profissional responsável e acompanhamento de andamento até a conclusão.",
  },
  {
    icone: ShieldCheck,
    titulo: "4. Entrega e retorno",
    texto:
      "Vistoria de saída, entrega conferida e, nos serviços com garantia, um retorno agendado para revisão.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ---------- Cabecalho ---------- */}
      <header className="sticky top-0 z-50 border-b border-carvao-800 bg-carvao-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label={`${EMPRESA.nome} — página inicial`}>
            <Logo invertido />
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
            {NAV.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-carvao-300 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={whatsappLink(MSG_PADRAO)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-marca-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-600"
            >
              Orçamento
            </a>
            <Link
              href="/login"
              className="hidden rounded-md border border-carvao-700 px-3 py-2 text-sm font-medium text-carvao-300 transition hover:border-carvao-500 hover:text-white sm:block"
            >
              Área interna
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden bg-carvao-950 text-white">
          <div aria-hidden className="listras-marca absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-marca-600/25 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-marca-500/40 bg-marca-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-marca-300">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {EMPRESA.bairro} · {EMPRESA.cidade}/{EMPRESA.uf}
              </p>

              <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                O mundo dos
                <br />
                serviços para
                <br />
                <span className="text-marca-500">o seu veículo</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-carvao-300">
                Estética automotiva, funilaria, insulfilm e revitalização com mais de{" "}
                <strong className="text-white">16 anos de experiência</strong>. Orçamento
                por escrito, vistoria documentada e garantia acompanhada.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappLink(MSG_PADRAO)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-marca-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-marca-500/25 transition hover:bg-marca-600"
                >
                  Pedir orçamento no WhatsApp
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href="#servicos"
                  className="inline-flex items-center justify-center rounded-md border border-carvao-700 px-7 py-3.5 font-semibold text-white transition hover:border-white"
                >
                  Ver serviços
                </a>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-carvao-800 pt-8">
                {[
                  ["16+", "anos de experiência"],
                  ["6", "linhas de serviço"],
                  ["100%", "vistoria documentada"],
                ].map(([valor, rotulo]) => (
                  <div key={rotulo}>
                    <dt className="font-display text-3xl font-extrabold text-marca-500">
                      {valor}
                    </dt>
                    <dd className="mt-1 text-xs uppercase tracking-wider text-carvao-400">
                      {rotulo}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Cartao de contato rapido */}
            <aside className="rounded-xl border border-carvao-800 bg-carvao-900/70 p-7 backdrop-blur">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
                Fale com a gente
              </h2>
              <p className="mt-2 text-sm text-carvao-400">
                Atendimento direto, sem intermediário.
              </p>

              <ul className="mt-6 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-marca-500" aria-hidden />
                  <a
                    href={`tel:+${EMPRESA.whatsapp}`}
                    className="font-semibold text-white hover:text-marca-400"
                  >
                    {EMPRESA.telefone}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-marca-500" aria-hidden />
                  <a
                    href={EMPRESA.mapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-carvao-300 hover:text-white"
                  >
                    {enderecoCompleto()}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <IconeInstagram className="mt-0.5 h-4 w-4 shrink-0 text-marca-500" />
                  <a
                    href={EMPRESA.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-carvao-300 hover:text-white"
                  >
                    {EMPRESA.instagramHandle}
                  </a>
                </li>
              </ul>

              <div className="mt-6 border-t border-carvao-800 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-carvao-500">
                  Horário
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {EMPRESA.horarios.map((h) => (
                    <li key={h.dia} className="flex justify-between gap-4">
                      <span className="text-carvao-400">{h.dia}</span>
                      <span className="font-medium text-white">{h.hora}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* ---------- Servicos ---------- */}
        <section id="servicos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <header className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-marca-500">
              O que fazemos
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-carvao-950 sm:text-5xl">
              Serviços completos para o seu carro
            </h2>
            <p className="mt-4 text-lg text-carvao-600">
              Da lavagem à funilaria, tudo no mesmo lugar — com orçamento formal e
              responsável identificado em cada etapa.
            </p>
          </header>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICOS_VITRINE.map((s) => (
              <article
                key={s.slug}
                className="group flex flex-col rounded-xl border border-carvao-200 bg-white p-7 transition hover:-translate-y-1 hover:border-marca-500 hover:shadow-xl hover:shadow-carvao-950/5"
              >
                <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-carvao-950">
                  {s.titulo}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-carvao-600">{s.resumo}</p>
                <ul className="mt-5 space-y-2 border-t border-carvao-100 pt-5">
                  {s.itens.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-carvao-700">
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-marca-500"
                        aria-hidden
                      />
                      {i}
                    </li>
                  ))}
                </ul>
                <a
                  href={whatsappLink(
                    `Olá! Gostaria de um orçamento de ${s.titulo} na ${EMPRESA.nome}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 transition group-hover:gap-2.5 hover:text-marca-700"
                >
                  Orçar este serviço
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Processo ---------- */}
        <section id="processo" className="scroll-mt-20 bg-carvao-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <header className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-marca-500">
                Como funciona
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
                Do orçamento à entrega
              </h2>
              <p className="mt-4 text-lg text-carvao-400">
                Um processo documentado em quatro etapas. Você sabe exatamente o que foi
                combinado, quem executou e o que fazer depois.
              </p>
            </header>

            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESSO.map((p) => (
                <li
                  key={p.titulo}
                  className="rounded-xl border border-carvao-800 bg-carvao-900/60 p-6"
                >
                  <p.icone className="h-7 w-7 text-marca-500" aria-hidden />
                  <h3 className="mt-4 font-display text-xl font-bold uppercase tracking-tight">
                    {p.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-400">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Diferenciais ---------- */}
        <section id="diferenciais" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-marca-500">
                Por que a World Car
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-tight tracking-tight text-carvao-950 sm:text-5xl">
                Seu carro tratado
                <br />
                com <span className="text-marca-500">método</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-carvao-600">
                A World Car Service nasceu de um sonho e de mais de 16 anos de experiência
                no setor automotivo. O que nos diferencia não é só o acabamento — é o
                registro de cada etapa.
              </p>
              <a
                href={whatsappLink(MSG_PADRAO)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-md bg-carvao-950 px-7 py-3.5 font-semibold text-white transition hover:bg-marca-600"
              >
                Agendar avaliação
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2">
              {DIFERENCIAIS.map((d) => (
                <li
                  key={d.titulo}
                  className="rounded-xl border-l-4 border-marca-500 bg-carvao-50 p-6"
                >
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-carvao-950">
                    {d.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-600">{d.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Contato / CTA ---------- */}
        <section id="contato" className="scroll-mt-20 bg-marca-600 py-20 text-white">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
              Traga seu carro para uma avaliação
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-marca-100">
              Avaliação sem compromisso. Você sai com o orçamento em mãos, por escrito.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={whatsappLink(MSG_PADRAO)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-8 py-4 font-semibold text-carvao-950 transition hover:bg-carvao-100"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {EMPRESA.telefone}
              </a>
              <a
                href={EMPRESA.mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-white/60 px-8 py-4 font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                <MapPin className="h-4 w-4" aria-hidden />
                Como chegar
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Rodape ---------- */}
      <footer className="bg-carvao-950 py-12 text-carvao-400">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Logo invertido />
              <p className="mt-4 max-w-sm text-sm leading-relaxed">
                {EMPRESA.slogan}. Estética automotiva, funilaria e revitalização em{" "}
                {EMPRESA.cidade}/{EMPRESA.uf}.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                Serviços
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                {SERVICOS_VITRINE.map((s) => (
                  <li key={s.slug}>
                    <a href="#servicos" className="hover:text-marca-400">
                      {s.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                Contato
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href={`tel:+${EMPRESA.whatsapp}`} className="hover:text-marca-400">
                    {EMPRESA.telefone}
                  </a>
                </li>
                <li>
                  <a
                    href={EMPRESA.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-marca-400"
                  >
                    {EMPRESA.instagramHandle}
                  </a>
                </li>
                <li className="pt-1 leading-relaxed">{enderecoCompleto()}</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-carvao-800 pt-6 text-xs sm:flex-row">
            <p>
              © {new Date().getFullYear()} {EMPRESA.nome}. Todos os direitos reservados.
            </p>
            <Link href="/login" className="hover:text-marca-400">
              Área interna
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
