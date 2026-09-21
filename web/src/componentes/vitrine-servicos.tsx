import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin, ShieldCheck } from "lucide-react";
import { sb } from "@/lib/supabase";

/**
 * Vitrine de servicos e informacoes de visita.
 *
 * Substitui a tabela de precos que ocupava a landing inteira. Com o
 * autoatendimento no ar, listar vinte e seis linhas de preco aqui era repetir o
 * que a tela de agendamento ja faz melhor — e ocupando o melhor espaco da
 * pagina com uma decisao que o visitante ainda nao esta pronto para tomar.
 *
 * Aqui fica o resumo que ajuda a decidir: o que existe, a partir de quanto, e
 * quanto tempo leva. Quem quer o preco exato de um servico clica e agenda.
 *
 * O horario de funcionamento vem do cadastro da agenda, nao de um texto fixo:
 * quando a oficina mudar o horario de verao, o site muda junto.
 */

type ServicoPublico = {
  nome: string; categoria: string; preco: number;
  duracaoMin: number | null; garantiaDias: number;
};

type Horario = {
  diaSemana: number; aberto: boolean;
  abre: string; fecha: string;
  pausaInicio: string | null; pausaFim: string | null;
};

type EmpresaPublica = {
  endereco: string | null; cidade: string | null; uf: string | null;
  cep: string | null; horarios: Horario[];
};

const CATEGORIAS: { chave: string; titulo: string; texto: string }[] = [
  { chave: "LAVAGEM", titulo: "Lavagem",
    texto: "Do básico do dia a dia à lavagem detalhada, por dentro e por fora." },
  { chave: "ESTETICA", titulo: "Estética automotiva",
    texto: "Polimento, higienização e tratamento de couro e plásticos." },
  { chave: "VITRIFICACAO", titulo: "Vitrificação",
    texto: "Camada protetora sobre a pintura, com brilho que dura." },
  { chave: "PELICULA", titulo: "Películas",
    texto: "Insulfilm, proteção solar e película de segurança." },
  { chave: "REVITALIZACAO", titulo: "Revitalização",
    texto: "Devolve a aparência de peças desgastadas pelo tempo e pelo sol." },
  { chave: "FUNILARIA", titulo: "Funilaria e pintura",
    texto: "Reparo de amassados e repintura com acabamento de fábrica." },
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Agrupa dias seguidos com o mesmo horario.
 *
 * "Segunda a sexta, 8h às 18h" é como as pessoas leem um horário. Sete linhas
 * repetindo a mesma faixa é ruído que ninguém termina de ler.
 */
function agruparDias(horarios: Horario[]) {
  const ordenados = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => horarios.find((h) => h.diaSemana === d))
    .filter((h): h is Horario => Boolean(h));

  const faixas: { dias: number[]; h: Horario }[] = [];
  for (const h of ordenados) {
    const ultima = faixas.at(-1);
    const igual = ultima
      && ultima.h.aberto === h.aberto
      && ultima.h.abre === h.abre
      && ultima.h.fecha === h.fecha
      && ultima.h.pausaInicio === h.pausaInicio;
    if (igual) ultima.dias.push(h.diaSemana);
    else faixas.push({ dias: [h.diaSemana], h });
  }
  return faixas;
}

const rotuloDias = (dias: number[]) =>
  dias.length === 1
    ? DIAS[dias[0]]
    : `${DIAS[dias[0]]} a ${DIAS[dias.at(-1)!]}`;

export function VitrineServicos() {
  const [servicos, setServicos] = useState<ServicoPublico[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaPublica | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [c, e] = await Promise.all([
        sb.rpc("catalogo_publico"),
        sb.rpc("empresa_publica"),
      ]);
      if (!vivo) return;
      setServicos((c.data as ServicoPublico[]) ?? []);
      setEmpresa((e.data as EmpresaPublica) ?? null);
    })();
    return () => { vivo = false; };
  }, []);

  // Se o catálogo não carregar, a seção some inteira em vez de mostrar cartões
  // vazios: página de vendas com buraco é pior do que uma seção a menos.
  if (servicos.length === 0) return null;

  const resumo = CATEGORIAS.map((c) => {
    const lista = servicos.filter((s) => s.categoria === c.chave);
    if (lista.length === 0) return null;
    const menor = Math.min(...lista.map((s) => Number(s.preco)));
    const comGarantia = lista.filter((s) => s.garantiaDias > 0).length;
    return { ...c, quantos: lista.length, menor, comGarantia };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const faixas = empresa?.horarios ? agruparDias(empresa.horarios) : [];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumo.map((c) => (
          <Link key={c.chave} to="/agendar"
            className="group flex flex-col rounded-xl border border-carvao-200 bg-white p-6 transition hover:-translate-y-1 hover:border-marca-500 hover:shadow-xl hover:shadow-carvao-950/5">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-carvao-950">
              {c.titulo}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-carvao-600">
              {c.texto}
            </p>

            <p className="mt-4 text-xs text-carvao-500">
              {c.quantos} {c.quantos === 1 ? "opção" : "opções"}
              {c.comGarantia > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  com garantia
                </span>
              )}
            </p>

            <div className="mt-3 flex items-end justify-between border-t border-carvao-100 pt-3">
              <span>
                <span className="block text-[10px] uppercase tracking-wide text-carvao-400">
                  A partir de
                </span>
                <span className="font-display text-2xl font-extrabold text-carvao-950">
                  {reais(c.menor)}
                </span>
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-marca-600 transition group-hover:gap-2">
                Ver horários
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* ----------------------------------------- onde e quando */}
      {empresa && (
        <div className="mt-10 grid gap-6 rounded-xl border border-carvao-200 bg-white p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <Clock className="h-5 w-5 text-marca-500" aria-hidden />
              Quando abrimos
            </h3>
            <dl className="mt-3 space-y-1.5">
              {faixas.map((f) => (
                <div key={f.dias.join()} className="flex justify-between gap-4 text-sm">
                  <dt className="text-carvao-600">{rotuloDias(f.dias)}</dt>
                  <dd className={f.h.aberto ? "font-semibold text-carvao-950" : "text-carvao-400"}>
                    {f.h.aberto
                      ? f.h.pausaInicio && f.h.pausaFim
                        ? `${f.h.abre} às ${f.h.pausaInicio} · ${f.h.pausaFim} às ${f.h.fecha}`
                        : `${f.h.abre} às ${f.h.fecha}`
                      : "Fechado"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              <MapPin className="h-5 w-5 text-marca-500" aria-hidden />
              Onde estamos
            </h3>
            <address className="mt-3 text-sm not-italic leading-relaxed text-carvao-600">
              {empresa.endereco}
              {empresa.cidade && <><br />{empresa.cidade}/{empresa.uf}</>}
              {empresa.cep && <><br />CEP {empresa.cep}</>}
            </address>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${
                encodeURIComponent(
                  [empresa.endereco, empresa.cidade, empresa.uf].filter(Boolean).join(", "),
                )}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-marca-600 hover:underline"
            >
              Abrir no mapa
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
