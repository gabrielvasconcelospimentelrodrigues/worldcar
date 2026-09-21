import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Aviso, Botao, Selecao } from "@/componentes/ui";
import { dataHora } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Vistoria } from "@/lib/tipos";

/**
 * Conferencia de limpeza pos-lavagem.
 *
 * E controle de qualidade interno, diferente da vistoria de entrada e de saida:
 * aquelas documentam o carro para o cliente, esta decide se o servico esta bem
 * feito. Reprovar devolve o item para quem executou, com o motivo — nao adianta
 * mandar refazer sem dizer o que estava errado.
 *
 * Fica por item, e nao pela OS inteira, porque a lavagem externa pode estar
 * perfeita e a higienizacao interna nao: quem refaz e so quem errou.
 */

const PONTOS = ["Vidros", "Tapetes", "Painel", "Bancos", "Rodas", "Porta-malas"];

export function ConferirLimpeza({
  itemId, descricao, equipe, aoConferir,
}: {
  itemId: string;
  descricao: string;
  equipe: { id: string; nome: string }[];
  aoConferir: () => void;
}) {
  const [historico, setHistorico] = useState<Vistoria[]>([]);
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<Record<string, boolean | undefined>>({});
  const [motivo, setMotivo] = useState("");
  const [vistoriador, setVistoriador] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await sb.from("vistorias").select("*")
        .eq("itemId", itemId).eq("tipo", "LIMPEZA").order("data");
      if (vivo) setHistorico((data as Vistoria[]) ?? []);
    })();
    return () => { vivo = false; };
  }, [itemId, aberto]);

  const ultima = historico.at(-1);
  const pendencias = PONTOS.filter((p) => marcados[p] === false);

  async function enviar(aprovada: boolean) {
    setErro(null);
    if (!vistoriador) return setErro("Diga quem está conferindo.");
    if (!aprovada && !motivo.trim()) {
      return setErro("Descreva o que precisa ser refeito.");
    }
    setOcupado(true);
    const checklist: Record<string, string> = {};
    for (const p of PONTOS) {
      if (p in marcados) checklist[p] = marcados[p] ? "OK" : "Refazer";
    }
    const { error } = await sb.rpc("conferir_limpeza", {
      p_item_id: itemId,
      p_vistoriador: vistoriador,
      p_aprovada: aprovada,
      p_checklist: checklist,
      p_motivo: aprovada ? null : motivo.trim(),
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setAberto(false);
    setMotivo("");
    setMarcados({});
    aoConferir();
  }

  return (
    <div className="mt-3 rounded-md border border-carvao-200 bg-carvao-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-carvao-600">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Conferência de limpeza
        </p>
        {!aberto && (
          <Botao type="button" variante="fantasma" className="px-3 py-1 text-xs"
            onClick={() => setAberto(true)}>
            {ultima?.resultadoLimpeza === "REPROVADA" ? "Conferir de novo" : "Conferir"}
          </Botao>
        )}
      </div>

      {historico.length > 0 && (
        <ul className="mt-2 space-y-1">
          {historico.map((v) => (
            <li key={v.id} className="flex items-start gap-1.5 text-xs">
              {v.resultadoLimpeza === "APROVADA" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marca-600" aria-hidden />
              )}
              <span className={v.resultadoLimpeza === "APROVADA"
                ? "text-emerald-800" : "text-marca-700"}>
                <strong>
                  {v.resultadoLimpeza === "APROVADA" ? "Aprovada" : "Reprovada"}
                </strong>{" "}
                em {dataHora(v.data)}
                {v.motivoReprovacao && ` — ${v.motivoReprovacao}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 space-y-3 border-t border-carvao-200 pt-3">
          <Selecao rotulo="Quem está conferindo" value={vistoriador}
            onChange={(e) => setVistoriador(e.target.value)} className="max-w-64">
            <option value="">Selecione...</option>
            {equipe.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-carvao-700">
              Pontos conferidos em {descricao}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PONTOS.map((p) => {
                const estado = marcados[p];
                return (
                  <button key={p} type="button"
                    // Tres estados de proposito: nao conferido nao e a mesma
                    // coisa que conferido e reprovado.
                    onClick={() => setMarcados((m) => ({
                      ...m, [p]: m[p] === undefined ? true : m[p] ? false : undefined,
                    }))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      estado === true ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                        : estado === false ? "border-marca-400 bg-marca-50 text-marca-700"
                          : "border-carvao-300 bg-white text-carvao-500"}`}>
                    {p}{estado === true ? " ✓" : estado === false ? " ✗" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor={`motivo-${itemId}`}
              className="mb-1 block text-xs font-semibold text-carvao-700">
              O que precisa ser refeito
            </label>
            <textarea id={`motivo-${itemId}`} rows={2} value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={pendencias.length
                ? `Ex.: ${pendencias.join(", ").toLowerCase()} fora do padrão.`
                : "Obrigatório apenas ao reprovar."}
              className="w-full rounded-md border border-carvao-300 px-3 py-2 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
          </div>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}

          <div className="flex flex-wrap gap-2">
            <Botao type="button" disabled={ocupado} onClick={() => void enviar(true)}
              className="bg-emerald-600 px-4 py-1.5 text-xs hover:bg-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Aprovar e liberar
            </Botao>
            <Botao type="button" variante="fantasma" disabled={ocupado}
              onClick={() => void enviar(false)} className="px-4 py-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reprovar e mandar refazer
            </Botao>
            <button type="button" onClick={() => setAberto(false)}
              className="px-2 text-xs font-semibold text-carvao-500 hover:text-carvao-900">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
