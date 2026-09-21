import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Aviso, Botao, Selecao } from "./ui";
import {
  TIPOS_FIPE, anoDoRotulo, anos, combustivelDoRotulo, marcas, modelos,
  type ItemFipe, type TipoVeiculoFipe,
} from "@/lib/fipe";

export type EscolhaFipe = { marca: string; modelo: string; ano: number | null };

/**
 * Preenchimento assistido pela tabela FIPE: tipo -> marca -> modelo -> ano.
 * Nao substitui os campos do formulario — escreve neles e sai da frente, para
 * o veiculo fora da tabela (importado, antigo, adaptado) continuar aceitando
 * digitacao livre.
 */
export function BuscaFipe({ aoEscolher }: { aoEscolher: (e: EscolhaFipe) => void }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoVeiculoFipe>("carros");

  const [listaMarcas, setListaMarcas] = useState<ItemFipe[]>([]);
  const [listaModelos, setListaModelos] = useState<ItemFipe[]>([]);
  const [listaAnos, setListaAnos] = useState<ItemFipe[]>([]);

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Marcas do tipo escolhido
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    marcas(tipo)
      .then((m) => { if (vivo) setListaMarcas(m); })
      .catch((e: Error) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberto, tipo]);

  // Modelos da marca
  useEffect(() => {
    if (!marca) { setListaModelos([]); return; }
    let vivo = true;
    setCarregando(true);
    modelos(tipo, marca)
      .then((m) => { if (vivo) setListaModelos(m); })
      .catch((e: Error) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tipo, marca]);

  // Anos do modelo
  useEffect(() => {
    if (!marca || !modelo) { setListaAnos([]); return; }
    let vivo = true;
    setCarregando(true);
    anos(tipo, marca, modelo)
      .then((a) => { if (vivo) setListaAnos(a); })
      .catch((e: Error) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tipo, marca, modelo]);

  function aplicar() {
    const nomeMarca = listaMarcas.find((m) => m.codigo === marca)?.nome ?? "";
    const nomeModelo = listaModelos.find((m) => m.codigo === modelo)?.nome ?? "";
    const rotuloAno = listaAnos.find((a) => a.codigo === ano)?.nome ?? "";
    if (!nomeMarca || !nomeModelo) return;

    aoEscolher({
      marca: nomeMarca,
      modelo: nomeModelo,
      ano: rotuloAno ? anoDoRotulo(rotuloAno) : null,
    });
    fechar();
  }

  function fechar() {
    setAberto(false);
    setMarca("");
    setModelo("");
    setAno("");
    setErro(null);
  }

  if (!aberto) {
    return (
      <Botao type="button" variante="fantasma" onClick={() => setAberto(true)}>
        <Search className="h-4 w-4" aria-hidden />
        Buscar na tabela FIPE
      </Botao>
    );
  }

  const rotuloAno = listaAnos.find((a) => a.codigo === ano)?.nome ?? "";
  const combustivel = rotuloAno ? combustivelDoRotulo(rotuloAno) : null;

  return (
    <div className="rounded-md border border-carvao-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-sm font-bold uppercase tracking-tight text-carvao-950">
          Tabela FIPE
        </h4>
        <button type="button" onClick={fechar}
          className="rounded p-1 text-carvao-500 hover:text-carvao-900"
          aria-label="Fechar busca FIPE">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selecao rotulo="Tipo" value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoVeiculoFipe);
            setMarca(""); setModelo(""); setAno("");
          }}>
          {TIPOS_FIPE.map((t) => (
            <option key={t.valor} value={t.valor}>{t.rotulo}</option>
          ))}
        </Selecao>

        <Selecao rotulo="Marca" value={marca} disabled={listaMarcas.length === 0}
          onChange={(e) => { setMarca(e.target.value); setModelo(""); setAno(""); }}>
          <option value="">
            {listaMarcas.length === 0 ? "Carregando..." : "Selecione..."}
          </option>
          {listaMarcas.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.nome}</option>
          ))}
        </Selecao>

        <Selecao rotulo="Modelo" value={modelo} disabled={!marca || listaModelos.length === 0}
          onChange={(e) => { setModelo(e.target.value); setAno(""); }}>
          <option value="">
            {!marca ? "Escolha a marca" : listaModelos.length === 0 ? "Carregando..." : "Selecione..."}
          </option>
          {listaModelos.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.nome}</option>
          ))}
        </Selecao>

        <Selecao rotulo="Ano" value={ano} disabled={!modelo || listaAnos.length === 0}
          onChange={(e) => setAno(e.target.value)}>
          <option value="">
            {!modelo ? "Escolha o modelo" : listaAnos.length === 0 ? "Carregando..." : "Selecione..."}
          </option>
          {listaAnos.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nome}</option>
          ))}
        </Selecao>
      </div>

      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Botao type="button" onClick={aplicar} disabled={!marca || !modelo || carregando}>
          <Check className="h-4 w-4" aria-hidden />
          Usar estes dados
        </Botao>
        {combustivel && (
          <span className="text-xs text-carvao-500">Combustível: {combustivel}</span>
        )}
        <span className="text-xs text-carvao-500">
          Não achou? Feche e digite manualmente.
        </span>
      </div>
    </div>
  );
}
