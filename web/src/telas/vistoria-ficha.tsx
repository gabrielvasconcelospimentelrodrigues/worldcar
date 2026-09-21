import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, FileText, Pencil, Trash2, Upload } from "lucide-react";
import {
  Aviso, Badge, Botao, BotaoLink, Campo, Cartao, CabecalhoCartao, Dado, TituloPagina,
} from "@/componentes/ui";
import { CHECKLIST_VISTORIA, ESTADO_VISTORIA } from "@/lib/constantes";
import { dataHora, numeroDoc } from "@/lib/format";
import { useEquipe } from "@/lib/equipe";
import {
  MAX_FOTOS, enviarFoto, fotoParaPdf, registrarFotos, removerFoto, urlsAssinadas,
} from "@/lib/fotos";
import { mensagemErro, sb } from "@/lib/supabase";
import type {
  Avaria, EstadoItemVistoria, OrdemServico, Vistoria, VistoriaFoto,
} from "@/lib/tipos";
import { reservarAba } from "@/pdf/aba";

type FotoNaTela = VistoriaFoto & { src: string | null };

export function FichaVistoria() {
  const { id } = useParams<{ id: string }>();
  const { nome: nomeFuncionario, membro } = useEquipe();
  const entrada = useRef<HTMLInputElement>(null);

  const [v, setV] = useState<Vistoria | null>(null);
  const [ordem, setOrdem] = useState<(OrdemServico & {
    clientes: { nome: string } | null;
    veiculos: { marca: string; modelo: string; placa: string } | null;
  }) | null>(null);
  const [fotos, setFotos] = useState<FotoNaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [quantas, setQuantas] = useState(0);
  const [ampliada, setAmpliada] = useState<FotoNaTela | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const { data: vv } = await sb.from("vistorias").select("*").eq("id", id).maybeSingle();
    const vis = vv as Vistoria | null;
    setV(vis);

    if (vis) {
      const [{ data: o }, { data: fs }] = await Promise.all([
        sb.from("ordens_servico")
          .select("*, clientes(nome), veiculos(marca, modelo, placa)")
          .eq("id", vis.ordemId).maybeSingle(),
        sb.from("vistoria_fotos").select("*").eq("vistoriaId", id).order("criadoEm"),
      ]);
      setOrdem(o as never);

      const lista = (fs as VistoriaFoto[]) ?? [];
      const assinadas = await urlsAssinadas(lista.map((f) => f.caminho));
      setFotos(lista.map((f) => ({ ...f, src: assinadas.get(f.caminho) ?? null })));
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const arquivos = [...(entrada.current?.files ?? [])];
    if (arquivos.length === 0) return setErro("Selecione ao menos uma foto.");

    const espaco = MAX_FOTOS - fotos.length;
    if (arquivos.length > espaco) {
      return setErro(`Cabem mais ${espaco} foto(s); você selecionou ${arquivos.length}.`);
    }

    setEnviando(true);
    setErro(null);
    setOk(null);

    const legenda = String(new FormData(e.currentTarget).get("legenda") ?? "");
    const enviadas: string[] = [];
    const falhas: string[] = [];

    for (const arquivo of arquivos) {
      const r = await enviarFoto(id, arquivo);
      if (r.ok) enviadas.push(r.caminho);
      else falhas.push(r.erro);
    }

    if (enviadas.length > 0) await registrarFotos(id, enviadas, legenda);

    setEnviando(false);
    if (entrada.current) entrada.current.value = "";
    setQuantas(0);

    if (falhas.length > 0) {
      setErro(enviadas.length > 0
        ? `${enviadas.length} foto(s) enviada(s). Falhas: ${falhas.join(" ")}`
        : falhas.join(" "));
    } else {
      setOk(`${enviadas.length} foto(s) anexada(s) à vistoria.`);
    }
    await carregar();
  }

  async function apagar(foto: FotoNaTela) {
    setErro(null);
    try {
      await removerFoto(foto);
    } catch (e) {
      return setErro(mensagemErro(e));
    }
    await carregar();
  }

  async function gerarPdf(baixar: boolean, aba: Window | null) {
    if (!v || !ordem) return;
    setGerandoPdf(true);
    setErro(null);
    try {
      const [{ baixarPdfVistoria }, cli, vei] = await Promise.all([
        import("@/pdf/gerar"),
        sb.from("clientes").select("*").eq("id", ordem.clienteId).maybeSingle(),
        sb.from("veiculos").select("*").eq("id", ordem.veiculoId).maybeSingle(),
      ]);
      if (!cli.data || !vei.data) throw new Error("Cliente ou veículo não encontrado.");

      // Cada foto e reduzida para 700px antes de entrar no PDF: sem isso um
      // laudo com 30 fotos passaria de 100 MB.
      const preparadas = (
        await Promise.all(
          fotos.map(async (f) => {
            const dataUrl = await fotoParaPdf(f.caminho);
            return dataUrl ? { dataUrl, legenda: f.legenda } : null;
          }),
        )
      ).filter((f): f is { dataUrl: string; legenda: string | null } => f !== null);

      await baixarPdfVistoria(
        {
          v,
          os: ordem,
          cliente: cli.data as never,
          veiculo: vei.data as never,
          vistoriador: nomeFuncionario(v.funcionarioId),
          fotos: preparadas,
          fotosOmitidas: fotos.length - preparadas.length,
        },
        baixar,
        aba,
      );
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
  if (!v) return <Aviso tipo="erro">Vistoria não encontrada.</Aviso>;

  const checklist = (v.checklist ?? {}) as Record<string, EstadoItemVistoria>;
  const avarias = (v.avarias ?? []) as Avaria[];
  const comAvaria = Object.entries(checklist).filter(([, e]) => e === "AVARIA");
  const editavel = ordem ? !["ENTREGUE", "CANCELADA"].includes(ordem.status) : false;

  return (
    <>
      <TituloPagina
        titulo={`Vistoria de ${v.tipo === "ENTRADA" ? "entrada" : "saída"}`}
        descricao={
          ordem
            ? `OS ${numeroDoc(ordem.numero)} · ${ordem.clientes?.nome ?? ""} · ${ordem.veiculos?.marca ?? ""} ${ordem.veiculos?.modelo ?? ""} (${ordem.veiculos?.placa ?? ""})`
            : undefined
        }
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
            <BotaoLink to={`/sistema/vistorias/nova?ordem=${v.ordemId}&tipo=${v.tipo}`}
              variante="fantasma">
              <Pencil className="h-4 w-4" aria-hidden />
              Refazer
            </BotaoLink>
          </>
        }
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Checklist"
              descricao={`${Object.keys(checklist).length} itens conferidos`} />
            <div className="divide-y divide-carvao-100">
              {CHECKLIST_VISTORIA.map((grupo) => (
                <section key={grupo.grupo} className="p-5">
                  <h3 className="mb-3 font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                    {grupo.grupo}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.itens.map((item) => {
                      const e = checklist[item];
                      return (
                        <li key={item}
                          className="flex items-center justify-between gap-2 rounded-md border border-carvao-200 px-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-carvao-800">
                            {item}
                          </span>
                          {e ? (
                            <Badge cor={ESTADO_VISTORIA[e].cor}>{ESTADO_VISTORIA[e].label}</Badge>
                          ) : (
                            <Badge cor="bg-carvao-100 text-carvao-400">não conferido</Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Avarias registradas"
              descricao={`${avarias.length} ocorrência(s)`} />
            {avarias.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-carvao-500">
                Nenhuma avaria registrada nesta vistoria.
              </p>
            ) : (
              <ul className="divide-y divide-carvao-100">
                {avarias.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <p className="font-semibold text-carvao-950">{a.local}</p>
                      {a.descricao && (
                        <p className="mt-0.5 text-sm text-carvao-600">{a.descricao}</p>
                      )}
                    </div>
                    <Badge cor={
                      a.gravidade === "Grave" ? "bg-marca-700 text-white"
                        : a.gravidade === "Média" ? "bg-amber-600 text-white"
                          : "bg-carvao-200 text-carvao-800"
                    }>
                      {a.gravidade}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {/* Fotos */}
          <Cartao>
            <CabecalhoCartao titulo="Fotos da vistoria"
              descricao={fotos.length > 0
                ? `${fotos.length} foto(s) anexada(s)`
                : "Registre o estado do veículo em imagem"} />

            {fotos.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-carvao-500">
                Nenhuma foto anexada a esta vistoria.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
                {fotos.map((f) => (
                  <li key={f.id} className="group relative">
                    <button type="button" onClick={() => f.src && setAmpliada(f)}
                      disabled={!f.src}
                      className="block w-full overflow-hidden rounded-lg border border-carvao-200 bg-carvao-100 disabled:cursor-default"
                      aria-label={`Ampliar foto${f.legenda ? `: ${f.legenda}` : ""}`}>
                      {f.src ? (
                        <img src={f.src} alt={f.legenda ?? "Foto da vistoria"}
                          className="aspect-4/3 w-full object-cover transition group-hover:opacity-90" />
                      ) : (
                        <span className="flex aspect-4/3 w-full items-center justify-center text-xs text-carvao-500">
                          imagem indisponível
                        </span>
                      )}
                    </button>
                    {f.legenda && (
                      <p className="mt-1 truncate text-xs text-carvao-600">{f.legenda}</p>
                    )}
                    <p className="text-[10px] text-carvao-400">{dataHora(f.criadoEm)}</p>
                    {editavel && (
                      <button type="button" onClick={() => void apagar(f)}
                        className="absolute right-1.5 top-1.5 rounded-md bg-carvao-950/70 p-1.5 text-white opacity-0 transition hover:bg-marca-600 focus:opacity-100 group-hover:opacity-100"
                        aria-label="Remover foto">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editavel && (
              <form onSubmit={enviar}
                className="space-y-4 border-t border-carvao-200 bg-carvao-50 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="fotos"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600">
                      Fotos
                    </label>
                    <label htmlFor="fotos"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-carvao-400 bg-white px-4 py-3 text-sm text-carvao-600 transition hover:border-marca-500 hover:text-marca-600">
                      <Camera className="h-5 w-5 shrink-0" aria-hidden />
                      {quantas > 0
                        ? `${quantas} arquivo(s) selecionado(s)`
                        : "Tirar foto ou escolher do aparelho"}
                    </label>
                    <input ref={entrada} id="fotos" name="fotos" type="file" multiple
                      accept="image/*" className="sr-only"
                      onChange={(e) => setQuantas(e.target.files?.length ?? 0)} />
                    <p className="mt-1 text-xs text-carvao-500">
                      Reduzidas para 1600px no próprio aparelho antes de subir.
                    </p>
                  </div>
                  <Campo rotulo="Legenda (aplicada a todas)" name="legenda"
                    placeholder="Para-choque traseiro, risco lateral..." />
                </div>
                <Botao type="submit" disabled={enviando || quantas === 0}>
                  <Upload className="h-4 w-4" aria-hidden />
                  {enviando ? "Enviando..." : quantas === 0
                    ? "Selecione as fotos" : `Enviar ${quantas} foto(s)`}
                </Botao>
              </form>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
              Dados da vistoria
            </h2>
            <dl className="space-y-3">
              <Dado rotulo="Tipo">
                <Badge cor={v.tipo === "ENTRADA" ? "bg-blue-600 text-white" : "bg-carvao-950 text-white"}>
                  {v.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                </Badge>
              </Dado>
              <Dado rotulo="Data e hora">{dataHora(v.data)}</Dado>
              <Dado rotulo="Vistoriador">
                <span className="font-semibold">{nomeFuncionario(v.funcionarioId)}</span>
                <span className="block text-xs text-carvao-500">
                  {membro(v.funcionarioId)?.cargo ?? ""}
                </span>
              </Dado>
              <Dado rotulo="KM">{v.km ? v.km.toLocaleString("pt-BR") : "—"}</Dado>
              <Dado rotulo="Combustível">{v.combustivel ?? "—"}</Dado>
              <Dado rotulo="Cliente conferiu">
                {v.aprovadaCliente
                  ? <Badge cor="bg-emerald-600 text-white">Sim</Badge>
                  : "Não registrado"}
              </Dado>
              {ordem && (
                <Dado rotulo="Ordem de serviço">
                  <Link to={`/sistema/ordens/${v.ordemId}`}
                    className="font-semibold text-marca-600 hover:underline">
                    OS {numeroDoc(ordem.numero)}
                  </Link>
                </Dado>
              )}
            </dl>

            {v.pertences && (
              <div className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Pertences no veículo
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">{v.pertences}</p>
              </div>
            )}
            {v.observacoes && (
              <div className="mt-3 rounded-md border border-carvao-200 bg-carvao-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-carvao-700">{v.observacoes}</p>
              </div>
            )}
            {v.assinaturaCliente && (
              <figure className="mt-3">
                <figcaption className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Assinatura do cliente
                </figcaption>
                <img src={v.assinaturaCliente} alt="Assinatura do cliente"
                  className="mt-1 h-20 w-full rounded-md border border-carvao-200 bg-white object-contain p-1" />
              </figure>
            )}
          </Cartao>

          {comAvaria.length > 0 && (
            <Cartao className="border-marca-200 p-5">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-marca-700">
                Itens marcados como avaria
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-carvao-700">
                {comAvaria.map(([item]) => <li key={item}>• {item}</li>)}
              </ul>
            </Cartao>
          )}
        </div>
      </div>

      {ampliada?.src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog" aria-modal="true" aria-label={ampliada.legenda ?? "Foto da vistoria"}>
          <button type="button" className="absolute inset-0"
            onClick={() => setAmpliada(null)} aria-label="Fechar" />
          <figure className="relative max-h-full max-w-4xl">
            <img src={ampliada.src} alt={ampliada.legenda ?? "Foto da vistoria"}
              className="max-h-[80vh] w-auto rounded-lg object-contain" />
            <figcaption className="mt-3 text-center text-sm text-white">
              {ampliada.legenda ?? "Sem legenda"}
              <span className="block text-xs text-carvao-400">{dataHora(ampliada.criadoEm)}</span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
