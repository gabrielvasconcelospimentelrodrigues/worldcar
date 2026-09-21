import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Rotulo } from "@/componentes/ui";

/**
 * Selecao com busca.
 *
 * Um `<select>` comum serve para cinco opcoes. Com quase cem clientes — e a
 * lista so cresce — achar alguem vira rolagem as cegas, porque o select nativo
 * so casa pelo comeco do nome: quem procura "Silva" nao encontra "Ana Silva".
 *
 * A busca aqui casa em qualquer parte do texto, sem acento e sem caixa, e o
 * campo `busca` de cada opcao pode conter mais do que aparece na tela. E o que
 * permite achar um cliente pela PLACA do carro, que na oficina costuma ser o
 * que o atendente tem na mao quando o telefone toca.
 */

export type OpcaoBusca = {
  valor: string;
  rotulo: string;
  /** Segunda linha: telefone, placa, o que ajude a desambiguar homonimos. */
  detalhe?: string;
  /** Texto adicional que casa na busca sem aparecer. Cai para rotulo+detalhe. */
  busca?: string;
};

const semAcento = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Quantas opcoes desenhar. Passar de algumas dezenas nao ajuda a escolher. */
const MAXIMO = 50;

export function BuscaSelecao({
  rotulo,
  opcoes,
  valor,
  aoEscolher,
  placeholder = "Digite para buscar...",
  vazio = "Nenhum resultado.",
  dica,
  required,
  disabled,
  name,
  className = "",
}: {
  rotulo?: string;
  opcoes: OpcaoBusca[];
  valor: string;
  aoEscolher: (valor: string) => void;
  placeholder?: string;
  vazio?: string;
  dica?: string;
  required?: boolean;
  disabled?: boolean;
  /** Grava o valor num campo oculto, para formularios que leem FormData. */
  name?: string;
  className?: string;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [destacado, setDestacado] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const escolhida = opcoes.find((o) => o.valor === valor) ?? null;

  const filtradas = useMemo(() => {
    const t = semAcento(termo.trim());
    if (!t) return opcoes.slice(0, MAXIMO);
    // Cada palavra digitada precisa aparecer em algum lugar: "ana silva" acha
    // "Ana Paula da Silva" mesmo com um nome no meio.
    const partes = t.split(/\s+/);
    return opcoes
      .filter((o) => {
        const alvo = semAcento(o.busca ?? `${o.rotulo} ${o.detalhe ?? ""}`);
        return partes.every((p) => alvo.includes(p));
      })
      .slice(0, MAXIMO);
  }, [opcoes, termo]);

  useEffect(() => { setDestacado(0); }, [termo]);

  // Fecha ao clicar fora. Sem isto a lista ficaria por cima do resto do form.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
        setTermo("");
      }
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Mantem a opcao destacada visivel ao navegar pelo teclado.
  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector(`[data-indice="${destacado}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [destacado, aberto]);

  function abrir() {
    if (disabled) return;
    setAberto(true);
    setTermo("");
    // O foco precisa esperar o input existir no DOM.
    requestAnimationFrame(() => campo.current?.focus());
  }

  function escolher(opcao: OpcaoBusca) {
    aoEscolher(opcao.valor);
    setAberto(false);
    setTermo("");
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestacado((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestacado((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = filtradas[destacado];
      if (alvo) escolher(alvo);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      setTermo("");
    } else if (e.key === "Home") {
      e.preventDefault();
      setDestacado(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setDestacado(filtradas.length - 1);
    }
  }

  return (
    <div className={className}>
      {rotulo && <Rotulo htmlFor={id} obrigatorio={required}>{rotulo}</Rotulo>}

      <div ref={caixa} className="relative">
        {!aberto ? (
          <button
            type="button"
            id={id}
            disabled={disabled}
            onClick={abrir}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                abrir();
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={false}
            className={`flex w-full items-center gap-2 rounded-md border border-carvao-300 bg-white px-3 py-2 text-left text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20 disabled:bg-carvao-100 ${
              escolhida ? "text-carvao-950" : "text-carvao-400"}`}
          >
            <span className="min-w-0 flex-1 truncate">
              {escolhida ? escolhida.rotulo : placeholder}
              {escolhida?.detalhe && (
                <span className="ml-2 text-xs text-carvao-500">{escolhida.detalhe}</span>
              )}
            </span>
            {escolhida && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Limpar ${rotulo ?? "seleção"}`}
                onClick={(e) => { e.stopPropagation(); aoEscolher(""); }}
                className="rounded p-0.5 text-carvao-400 hover:bg-carvao-100 hover:text-marca-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-carvao-400" aria-hidden />
          </button>
        ) : (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carvao-400"
                aria-hidden
              />
              <input
                ref={campo}
                id={id}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={`${id}-lista`}
                aria-autocomplete="list"
                aria-activedescendant={
                  filtradas[destacado] ? `${id}-op-${destacado}` : undefined
                }
                value={termo}
                placeholder={placeholder}
                onChange={(e) => setTermo(e.target.value)}
                onKeyDown={teclado}
                className="w-full rounded-md border border-marca-500 bg-white py-2 pl-9 pr-3 text-sm text-carvao-950 placeholder:text-carvao-400 focus:outline-none focus:ring-2 focus:ring-marca-500/20"
              />
            </div>

            <ul
              ref={lista}
              id={`${id}-lista`}
              role="listbox"
              aria-label={rotulo ?? "Opções"}
              className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-carvao-200 bg-white py-1 shadow-lg"
            >
              {filtradas.length === 0 && (
                <li className="px-3 py-3 text-center text-sm text-carvao-500">{vazio}</li>
              )}
              {filtradas.map((o, i) => {
                const atual = o.valor === valor;
                return (
                  <li
                    key={o.valor}
                    id={`${id}-op-${i}`}
                    data-indice={i}
                    role="option"
                    aria-selected={atual}
                    onMouseEnter={() => setDestacado(i)}
                    onMouseDown={(e) => { e.preventDefault(); escolher(o); }}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                      i === destacado ? "bg-marca-50" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-carvao-950">
                        {o.rotulo}
                      </span>
                      {o.detalhe && (
                        <span className="block truncate text-xs text-carvao-500">
                          {o.detalhe}
                        </span>
                      )}
                    </span>
                    {atual && (
                      <Check className="h-4 w-4 shrink-0 text-marca-600" aria-hidden />
                    )}
                  </li>
                );
              })}
              {opcoes.length > filtradas.length && termo.trim() === "" && (
                <li className="border-t border-carvao-100 px-3 py-2 text-xs text-carvao-500">
                  Mostrando {filtradas.length} de {opcoes.length}. Digite para filtrar.
                </li>
              )}
            </ul>
          </>
        )}

        {/* Para os formularios que leem `new FormData(form)`. */}
        {name && <input type="hidden" name={name} value={valor} />}
      </div>

      {dica && <p className="mt-1 text-xs text-carvao-500">{dica}</p>}
    </div>
  );
}
