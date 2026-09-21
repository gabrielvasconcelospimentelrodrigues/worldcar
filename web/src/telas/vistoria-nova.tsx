import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, Selecao, TituloPagina,
} from "@/componentes/ui";
import { CampoAssinatura } from "@/componentes/assinatura";
import {
  CHECKLIST_VISTORIA, ESTADO_VISTORIA, NIVEIS_COMBUSTIVEL,
} from "@/lib/constantes";
import { numeroDoc } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { useEquipe } from "@/lib/equipe";
import { mensagemErro, sb } from "@/lib/supabase";
import type {
  Avaria, EstadoItemVistoria, OrdemServico, TipoVistoria, Vistoria,
} from "@/lib/tipos";
import { mascararInteiro, soDigitos } from "@/lib/mascaras";

const GRAVIDADES = ["Leve", "Média", "Grave"];
const LOCAIS = [
  "Para-choque dianteiro", "Para-choque traseiro", "Capô", "Teto", "Porta-malas",
  "Porta dianteira direita", "Porta traseira direita", "Porta dianteira esquerda",
  "Porta traseira esquerda", "Paralama direito", "Paralama esquerdo", "Parabrisa",
  "Vidro lateral", "Retrovisor", "Farol / lanterna", "Roda", "Interior",
];

type AvariaEditavel = Avaria & { chave: string };

export function NovaVistoria() {
  const [params] = useSearchParams();
  const { id: idRota } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { ativos } = useEquipe();

  const ordemId = params.get("ordem") ?? "";
  const tipo: TipoVistoria = params.get("tipo") === "SAIDA" ? "SAIDA" : "ENTRADA";

  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [existente, setExistente] = useState<Vistoria | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<Record<string, EstadoItemVistoria>>({});
  const [avarias, setAvarias] = useState<AvariaEditavel[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!ordemId) { navegar("/sistema/vistorias"); return; }

      const { data: o } = await sb
        .from("ordens_servico")
        .select("*, clientes(nome), veiculos(marca, modelo, placa)")
        .eq("id", ordemId)
        .maybeSingle();

      if (!vivo) return;
      const oo = o as (OrdemServico & {
        clientes: { nome: string } | null;
        veiculos: { marca: string; modelo: string; placa: string } | null;
      }) | null;

      setOrdem(oo);
      if (oo) {
        setRotulo(
          `OS ${numeroDoc(oo.numero)} · ${oo.clientes?.nome ?? ""} · ` +
          `${oo.veiculos?.marca ?? ""} ${oo.veiculos?.modelo ?? ""} (${oo.veiculos?.placa ?? ""})`,
        );
      }

      // Uma vistoria de cada tipo por OS: se ja existe, a tela edita a anterior
      const { data: v } = await sb
        .from("vistorias").select("*")
        .eq("ordemId", ordemId).eq("tipo", tipo).maybeSingle();

      if (!vivo) return;
      const vv = v as Vistoria | null;
      if (vv) {
        setExistente(vv);
        setChecklist((vv.checklist ?? {}) as Record<string, EstadoItemVistoria>);
        setAvarias(
          ((vv.avarias ?? []) as Avaria[]).map((a) => ({
            ...a, chave: Math.random().toString(36).slice(2, 10),
          })),
        );
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [ordemId, tipo, navegar, idRota]);

  const totalItens = useMemo(
    () => CHECKLIST_VISTORIA.reduce((s, g) => s + g.itens.length, 0), [],
  );
  const preenchidos = Object.keys(checklist).length;
  const comAvariaNoChecklist = Object.values(checklist).filter((v) => v === "AVARIA").length;

  const marcarGrupo = (itens: string[], valor: EstadoItemVistoria) =>
    setChecklist((c) => {
      const novo = { ...c };
      for (const i of itens) novo[i] = valor;
      return novo;
    });

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const f = new FormData(e.currentTarget);
    const funcionarioId = String(f.get("funcionarioId") ?? "");
    if (!funcionarioId) { setSalvando(false); return setErro("Informe o vistoriador."); }

    const assinatura = String(f.get("assinaturaCliente") ?? "");
    const registro = {
      ordemId,
      tipo,
      funcionarioId,
      km: Number(String(f.get("km") ?? "").replace(/\D/g, "")) || null,
      combustivel: String(f.get("combustivel") ?? "") || null,
      checklist,
      avarias: avarias.filter((a) => a.local).map(({ local, descricao, gravidade }) =>
        ({ local, descricao, gravidade })),
      pertences: String(f.get("pertences") ?? "").trim() || null,
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
      aprovadaCliente: f.get("aprovadaCliente") === "on",
      assinaturaCliente: assinatura.startsWith("data:image") ? assinatura : null,
    };

    const alvo = existente?.id ?? novoId();
    const { error } = existente
      ? await sb.from("vistorias").update(registro).eq("id", existente.id)
      : await sb.from("vistorias").insert({ ...registro, id: alvo, criadoEm: agora() });

    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    navegar(`/sistema/vistorias/${alvo}`);
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }
  if (!ordem) return <Aviso tipo="erro">Ordem de serviço não encontrada.</Aviso>;

  return (
    <>
      <TituloPagina
        titulo={`Vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
        descricao={
          existente
            ? "Já existe uma vistoria deste tipo nesta OS — salvar substitui a anterior."
            : `${rotulo} · registre o estado do veículo item por item.`
        }
      />

      <form onSubmit={salvar} className="space-y-6">
        <Cartao>
          <CabecalhoCartao
            titulo={`Vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
            descricao={rotulo}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Selecao rotulo="Vistoriador" name="funcionarioId" required
              defaultValue={existente?.funcionarioId ?? ""}>
              <option value="">Selecione...</option>
              {ativos.map((f) => (
                <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
              ))}
            </Selecao>
            <CampoMascara rotulo="KM" name="km"
              mascara={mascararInteiro} limpar={soDigitos} inputMode="numeric"
              defaultValue={existente?.km ?? (tipo === "ENTRADA" ? ordem.kmEntrada ?? "" : ordem.kmSaida ?? ordem.kmEntrada ?? "")} />
            <Selecao rotulo="Nível de combustível" name="combustivel"
              defaultValue={existente?.combustivel ?? ""}>
              <option value="">Não informado</option>
              {NIVEIS_COMBUSTIVEL.map((n) => <option key={n} value={n}>{n}</option>)}
            </Selecao>
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Checklist"
            descricao={`${preenchidos} de ${totalItens} itens conferidos`} />
          <div className="divide-y divide-carvao-100">
            {CHECKLIST_VISTORIA.map((grupo) => (
              <fieldset key={grupo.grupo} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <legend className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                    {grupo.grupo}
                  </legend>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => marcarGrupo(grupo.itens, "OK")}
                      className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                      Tudo OK
                    </button>
                    <button type="button" onClick={() => marcarGrupo(grupo.itens, "NA")}
                      className="rounded border border-carvao-300 px-2.5 py-1 text-xs font-semibold text-carvao-600 hover:bg-carvao-50">
                      Tudo N/A
                    </button>
                  </div>
                </div>

                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.itens.map((item) => {
                    const atual = checklist[item];
                    return (
                      <li key={item}
                        className="flex items-center justify-between gap-2 rounded-md border border-carvao-200 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-carvao-800">
                          {item}
                        </span>
                        <div role="radiogroup" aria-label={item} className="flex shrink-0 gap-1">
                          {(["OK", "AVARIA", "NA"] as EstadoItemVistoria[]).map((v) => (
                            <button key={v} type="button" role="radio" aria-checked={atual === v}
                              onClick={() => setChecklist((c) => ({ ...c, [item]: v }))}
                              className={`rounded px-2 py-1 text-[10px] font-bold transition ${
                                atual === v
                                  ? ESTADO_VISTORIA[v].cor
                                  : "bg-carvao-100 text-carvao-500 hover:bg-carvao-200"
                              }`}>
                              {ESTADO_VISTORIA[v].label}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Avarias encontradas"
            descricao="Registre riscos, amassados e trincas com localização"
            acao={
              <Botao type="button" variante="fantasma"
                onClick={() => setAvarias((a) => [...a, {
                  chave: Math.random().toString(36).slice(2, 10),
                  local: "", descricao: "", gravidade: "Leve",
                }])}>
                <Plus className="h-4 w-4" aria-hidden />
                Adicionar avaria
              </Botao>
            } />
          {avarias.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-carvao-500">
              Nenhuma avaria registrada.
            </p>
          ) : (
            <ul className="divide-y divide-carvao-100">
              {avarias.map((a, idx) => (
                <li key={a.chave} className="grid gap-3 p-5 sm:grid-cols-12">
                  <Selecao rotulo="Local" className="sm:col-span-4" value={a.local}
                    onChange={(e) => setAvarias((ls) => ls.map((x) =>
                      x.chave === a.chave ? { ...x, local: e.target.value } : x))}>
                    <option value="">Selecione...</option>
                    {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </Selecao>
                  <Campo rotulo="Descrição" className="sm:col-span-5" value={a.descricao}
                    placeholder="Risco de 10 cm, amassado leve..."
                    onChange={(e) => setAvarias((ls) => ls.map((x) =>
                      x.chave === a.chave ? { ...x, descricao: e.target.value } : x))} />
                  <Selecao rotulo="Gravidade" className="sm:col-span-2" value={a.gravidade}
                    onChange={(e) => setAvarias((ls) => ls.map((x) =>
                      x.chave === a.chave ? { ...x, gravidade: e.target.value } : x))}>
                    {GRAVIDADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </Selecao>
                  <div className="flex items-end sm:col-span-1">
                    <button type="button"
                      onClick={() => setAvarias((ls) => ls.filter((x) => x.chave !== a.chave))}
                      className="mb-1 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                      aria-label={`Remover avaria ${idx + 1}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Complementos" />
          <div className="space-y-4 p-5">
            <AreaTexto rotulo="Pertences deixados no veículo" name="pertences" rows={2}
              defaultValue={existente?.pertences ?? ""}
              placeholder="Documentos, cadeirinha, ferramentas, som..." />
            <AreaTexto rotulo="Observações gerais" name="observacoes" rows={3}
              defaultValue={existente?.observacoes ?? ""} />
            <label className="flex items-start gap-3 rounded-md border border-carvao-200 bg-carvao-50 p-4">
              <input type="checkbox" name="aprovadaCliente"
                defaultChecked={existente?.aprovadaCliente}
                className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]" />
              <span className="text-sm text-carvao-800">
                <strong className="block">Cliente conferiu e concordou com a vistoria</strong>
                <span className="text-carvao-600">
                  Marque depois de mostrar o laudo ao cliente. Fica registrado no PDF.
                </span>
              </span>
            </label>
            <CampoAssinatura name="assinaturaCliente" rotulo="Assinatura do cliente"
              valorInicial={existente?.assinaturaCliente}
              dica="Entregue o aparelho ao cliente para assinar. A assinatura sai impressa no laudo." />
          </div>
        </Cartao>

        {preenchidos < totalItens && (
          <Aviso>
            Faltam {totalItens - preenchidos} item(ns) do checklist. É possível salvar assim
            mesmo, mas o laudo fica incompleto.
          </Aviso>
        )}

        {comAvariaNoChecklist > 0 && avarias.length === 0 && (
          <Aviso tipo="erro">
            Há itens marcados como avaria no checklist, mas nenhuma avaria detalhada.
            Descreva-as acima para proteger a loja e o cliente.
          </Aviso>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex items-center justify-between gap-4">
          <Badge cor="bg-carvao-100 text-carvao-700">
            {avarias.length} avaria(s) · {preenchidos}/{totalItens} conferidos
          </Badge>
          <Botao type="submit" disabled={salvando} className="px-6 py-2.5">
            {salvando
              ? "Salvando..."
              : `Registrar vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
          </Botao>
        </div>
      </form>
    </>
  );
}
