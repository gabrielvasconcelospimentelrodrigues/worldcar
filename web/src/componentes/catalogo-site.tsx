import { useEffect, useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import { brl } from "@/lib/format";
import { sb } from "@/lib/supabase";

/**
 * Tabela de precos da landing page.
 *
 * Vem do catalogo real, pela funcao `catalogo_publico`. Duas razoes para nao
 * repetir os precos num arquivo de constantes: eles mudam, e uma tabela
 * desatualizada no site gera discussao no balcao — o cliente chega com o preco
 * antigo na mao e alguem tem de explicar. Aqui, mexeu no catalogo, mudou no
 * site.
 *
 * A funcao expoe colunas fixas de proposito: `servicos` guarda `comissaoPct` e
 * `custo`, que sao margem interna e nao podem sair no HTML publico.
 */

type ServicoPublico = {
  nome: string;
  categoria: string;
  preco: number;
  descricao: string | null;
  garantiaDias: number;
  duracaoMin: number | null;
};

const ROTULO: Record<string, { titulo: string; texto: string }> = {
  LAVAGEM: {
    titulo: "Lavagem",
    texto: "Do básico do dia a dia à lavagem detalhada, por dentro e por fora.",
  },
  ESTETICA: {
    titulo: "Estética automotiva",
    texto: "Polimento, higienização e tratamento de couro e plásticos.",
  },
  REVITALIZACAO: {
    titulo: "Revitalização",
    texto: "Devolve a aparência de peças desgastadas pelo tempo e pelo sol.",
  },
  VITRIFICACAO: {
    titulo: "Vitrificação",
    texto: "Camada protetora sobre a pintura, com brilho e proteção duradouros.",
  },
  PELICULA: {
    titulo: "Películas",
    texto: "Insulfilm, proteção solar e películas de segurança.",
  },
  FUNILARIA: {
    titulo: "Funilaria",
    texto: "Reparo de amassados, alinhamento e recuperação de estrutura.",
  },
  PINTURA: {
    titulo: "Pintura",
    texto: "Repintura de peças e retoques com acabamento de fábrica.",
  },
};

export function CatalogoSite({ aoPedirOrcamento }: { aoPedirOrcamento: (servico: string) => string }) {
  const [itens, setItens] = useState<ServicoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await sb.rpc("catalogo_publico");
      if (!vivo) return;
      setFalhou(Boolean(error));
      setItens((data as ServicoPublico[]) ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  // Agrupa preservando a ordem que o banco definiu (lavagem primeiro, pintura
  // por ultimo): Map mantem a ordem de insercao.
  const grupos = new Map<string, ServicoPublico[]>();
  for (const s of itens) {
    if (!grupos.has(s.categoria)) grupos.set(s.categoria, []);
    grupos.get(s.categoria)!.push(s);
  }

  if (carregando) {
    return (
      <p className="py-12 text-center text-sm text-carvao-500">Carregando serviços...</p>
    );
  }

  // Se o catalogo nao carregar, a secao some inteira em vez de mostrar uma
  // tabela vazia — pagina de vendas com buraco e pior do que uma secao a menos.
  if (falhou || itens.length === 0) return null;

  return (
    <div className="space-y-10">
      {[...grupos.entries()].map(([categoria, servicos]) => {
        const info = ROTULO[categoria] ?? { titulo: categoria, texto: "" };
        return (
          <div key={categoria}>
            <div className="mb-4 border-l-4 border-marca-500 pl-4">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-carvao-950">
                {info.titulo}
              </h3>
              {info.texto && (
                <p className="mt-0.5 text-sm text-carvao-500">{info.texto}</p>
              )}
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.map((s) => (
                <li key={s.nome}
                  className="flex flex-col rounded-lg border border-carvao-200 bg-white p-4 transition hover:border-marca-400 hover:shadow-md">
                  <p className="font-semibold text-carvao-950">{s.nome}</p>
                  {s.descricao && (
                    <p className="mt-1 flex-1 text-sm leading-relaxed text-carvao-500">
                      {s.descricao}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-carvao-500">
                    {s.duracaoMin ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {s.duracaoMin >= 60
                          ? `${Math.round((s.duracaoMin / 60) * 10) / 10}h`
                          : `${s.duracaoMin} min`}
                      </span>
                    ) : null}
                    {s.garantiaDias > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {s.garantiaDias} dias de garantia
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-end justify-between border-t border-carvao-100 pt-3">
                    <span>
                      <span className="block text-[10px] uppercase tracking-wide text-carvao-400">
                        A partir de
                      </span>
                      <span className="font-display text-xl font-extrabold text-carvao-950">
                        {brl(s.preco)}
                      </span>
                    </span>
                    <a
                      href={aoPedirOrcamento(s.nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-carvao-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-marca-600"
                    >
                      Orçar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="rounded-md bg-carvao-50 p-4 text-sm text-carvao-600">
        Os valores são o ponto de partida de cada serviço. O preço final depende do
        tamanho do veículo e do estado em que ele chega — por isso a avaliação é
        gratuita e o orçamento sai por escrito, com prazo e garantia.
      </p>
    </div>
  );
}
