import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Plus, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, Dado, Selecao, TituloPagina,
} from "@/componentes/ui";
import { data, documento, linkWhatsapp, placa as formatarPlaca, telefone } from "@/lib/format";
import { BuscaFipe } from "@/componentes/busca-fipe";
import { creditoDe, fotoDoModelo, type FotoModelo } from "@/lib/foto-modelo";
import { Fidelidade } from "@/componentes/fidelidade";
import { BlocoEndereco } from "@/componentes/bloco-endereco";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Cliente, Veiculo } from "@/lib/tipos";
import { mascararDocumento, mascararInteiro, mascararPlaca, mascararTelefone, soDigitos } from "@/lib/mascaras";

/**
 * Serve tanto /clientes/novo quanto /clientes/:id.
 * Na rota de cadastro nao existe `:id`, entao `criando` vem por prop — sem
 * isso a tela tentaria carregar um cliente de id indefinido e ficava em branco.
 */
export function FichaCliente({ criando = false }: { criando?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(!criando);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formVeiculo, setFormVeiculo] = useState(false);
  // Controlados porque a busca FIPE escreve neles; seguem editáveis à mão.
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anoVeiculo, setAnoVeiculo] = useState("");
  const [foto, setFoto] = useState<FotoModelo | null>(null);
  const [buscandoFoto, setBuscandoFoto] = useState(false);

  // Busca a foto do modelo enquanto o usuario ainda preenche o resto do
  // formulario. Espera 600ms porque marca e modelo podem estar sendo digitados
  // a mao — sem isso, "C", "Co", "Cor"... viram quatro consultas.
  useEffect(() => {
    if (!formVeiculo || !marca.trim() || !modelo.trim()) { setFoto(null); return; }
    let vivo = true;
    setBuscandoFoto(true);
    const t = setTimeout(async () => {
      const achada = await fotoDoModelo(marca, modelo, Number(anoVeiculo) || null);
      if (!vivo) return;
      setFoto(achada);
      setBuscandoFoto(false);
    }, 600);
    return () => { vivo = false; clearTimeout(t); };
  }, [marca, modelo, anoVeiculo, formVeiculo]);

  const carregar = useCallback(async () => {
    if (criando || !id) return;
    const [c, v] = await Promise.all([
      sb.from("clientes").select("*").eq("id", id).maybeSingle(),
      sb.from("veiculos").select("*").eq("clienteId", id).order("criadoEm", { ascending: false }),
    ]);
    if (c.error) setErro(mensagemErro(c.error));
    setCliente((c.data as Cliente) ?? null);
    setVeiculos((v.data as Veiculo[]) ?? []);
    setCarregando(false);
  }, [criando, id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarCliente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const vazio = (k: string) => String(f.get(k) ?? "").trim() || null;
    const registro = {
      tipo: String(f.get("tipo") ?? "FISICA"),
      nome: String(f.get("nome") ?? "").trim(),
      documento: vazio("documento")?.replace(/\D/g, "") ?? null,
      telefone: String(f.get("telefone") ?? "").trim(),
      descontoPct: (Number(f.get("descontoPct")) || 0).toFixed(2),
      telefone2: vazio("telefone2"),
      email: vazio("email"),
      cep: vazio("cep"),
      endereco: vazio("endereco"),
      numero: vazio("numero"),
      bairro: vazio("bairro"),
      cidade: vazio("cidade"),
      uf: vazio("uf")?.toUpperCase() ?? null,
      observacoes: vazio("observacoes"),
      atualizadoEm: new Date().toISOString(),
    };

    if (criando) {
      const novoId = crypto.randomUUID();
      const { error } = await sb.from("clientes").insert({ ...registro, id: novoId });
      setSalvando(false);
      if (error) return setErro(mensagemErro(error));
      navegar(`/sistema/clientes/${novoId}`, { replace: true });
      return;
    }

    const { error } = await sb.from("clientes").update(registro).eq("id", id!);
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    await carregar();
  }

  async function salvarVeiculo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const f = new FormData(e.currentTarget);
    const bruto = String(f.get("placa") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (bruto.length !== 7) return setErro("A placa precisa ter 7 caracteres.");

    const { error } = await sb.from("veiculos").insert({
      id: crypto.randomUUID(),
      clienteId: id,
      placa: bruto,
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: Number(anoVeiculo) || null,
      cor: String(f.get("cor") ?? "").trim() || null,
      km: Number(String(f.get("km") ?? "").replace(/\D/g, "")) || null,
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
      fotoUrl: foto?.url ?? null,
      fotoCredito: foto ? creditoDe(foto) : null,
      fotoOrigem: foto ? "WEB" : null,
      atualizadoEm: new Date().toISOString(),
    });
    if (error) return setErro(mensagemErro(error));
    setFormVeiculo(false);
    setMarca(""); setModelo(""); setAnoVeiculo(""); setFoto(null);
    await carregar();
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }
  if (!criando && !cliente) {
    return <Aviso tipo="erro">Cliente não encontrado.</Aviso>;
  }

  return (
    <>
      <TituloPagina
        titulo={criando ? "Novo cliente" : cliente!.nome}
        descricao={
          criando
            ? "Depois de salvar você poderá cadastrar os veículos."
            : `${cliente!.tipo === "JURIDICA" ? "Pessoa jurídica" : "Pessoa física"}${
                cliente!.documento ? ` · ${documento(cliente!.documento)}` : ""
              }`
        }
        acao={
          !criando && (
            <a
              href={linkWhatsapp(
                cliente!.telefone,
                `Olá ${cliente!.nome.split(" ")[0]}, aqui é da World Car Service.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-carvao-300 bg-white px-4 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500 hover:bg-carvao-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          )
        }
      />

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Cartao>
          <CabecalhoCartao titulo="Dados cadastrais" />
          <form onSubmit={salvarCliente} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Selecao rotulo="Tipo" name="tipo" defaultValue={cliente?.tipo ?? "FISICA"}>
                <option value="FISICA">Pessoa física</option>
                <option value="JURIDICA">Pessoa jurídica</option>
              </Selecao>
              <Campo rotulo="Nome / Razão social" name="nome" required
                defaultValue={cliente?.nome ?? ""} className="sm:col-span-2" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <CampoMascara rotulo="CPF / CNPJ" name="documento"
                mascara={mascararDocumento} limpar={soDigitos} inputMode="numeric"
                defaultValue={cliente?.documento ?? ""} placeholder="000.000.000-00" />
              <CampoMascara rotulo="Telefone / WhatsApp" name="telefone" required
                mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                defaultValue={cliente?.telefone ?? ""} placeholder="(41) 99999-0000" />
              <CampoMascara rotulo="Telefone secundário" name="telefone2"
                mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                defaultValue={cliente?.telefone2 ?? ""} placeholder="(41) 3333-4444" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="E-mail" name="email" type="email"
                className="sm:col-span-2" defaultValue={cliente?.email ?? ""} />
              <Campo rotulo="Desconto do cliente (%)" name="descontoPct"
                type="number" step="0.01" min={0} max={100}
                defaultValue={cliente?.descontoPct ?? 0}
                dica="Aplicado sozinho em novos orçamentos" />
            </div>

            <BlocoEndereco
              inicial={{
                cep: cliente?.cep,
                endereco: cliente?.endereco,
                numero: cliente?.numero,
                bairro: cliente?.bairro,
                cidade: cliente?.cidade ?? "Curitiba",
                uf: cliente?.uf ?? "PR",
              }}
            />

            <AreaTexto rotulo="Observações" name="observacoes"
              defaultValue={cliente?.observacoes ?? ""}
              placeholder="Preferências, histórico, restrições..." />

            <div className="flex justify-end border-t border-carvao-200 pt-5">
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : criando ? "Cadastrar cliente" : "Salvar alterações"}
              </Botao>
            </div>
          </form>
        </Cartao>

        {!criando && (
          <Cartao>
            <CabecalhoCartao
              titulo="Veículos"
              descricao={`${veiculos.length} cadastrado(s)`}
              acao={
                !formVeiculo && (
                  <Botao type="button" variante="fantasma" onClick={() => setFormVeiculo(true)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Adicionar
                  </Botao>
                )
              }
            />
            <ul className="divide-y divide-carvao-100">
              {veiculos.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-carvao-500">
                  Nenhum veículo cadastrado.
                </li>
              )}
              {veiculos.map((v) => (
                <li key={v.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {v.fotoUrl && (
                        <img src={v.fotoUrl} alt={`${v.marca} ${v.modelo}`} loading="lazy"
                          className="h-12 w-16 shrink-0 rounded object-cover ring-1 ring-carvao-200" />
                      )}
                      <div>
                      <p className="font-semibold text-carvao-950">
                        {v.marca} {v.modelo}{v.ano ? ` · ${v.ano}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-carvao-500">
                        {v.cor ?? "Cor não informada"}
                        {v.km ? ` · ${v.km.toLocaleString("pt-BR")} km` : ""}
                      </p>
                      </div>
                    </div>
                    <Badge cor="bg-carvao-950 text-white">{formatarPlaca(v.placa)}</Badge>
                  </div>
                </li>
              ))}
            </ul>

            {formVeiculo && (
              <form onSubmit={salvarVeiculo} className="space-y-4 border-t border-carvao-200 bg-carvao-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                    Novo veículo
                  </h3>
                  <button type="button" onClick={() => setFormVeiculo(false)}
                    className="rounded p-1 text-carvao-500 hover:text-carvao-900" aria-label="Cancelar">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <BuscaFipe
                  aoEscolher={(e) => {
                    setMarca(e.marca);
                    setModelo(e.modelo);
                    if (e.ano) setAnoVeiculo(String(e.ano));
                  }}
                />

                {(buscandoFoto || foto) && (
                  <div className="flex items-start gap-3 rounded-md border border-carvao-200 bg-white p-3">
                    {buscandoFoto ? (
                      <p className="text-sm text-carvao-500">Procurando foto do modelo...</p>
                    ) : foto ? (
                      <>
                        <img src={foto.url} alt={`${marca} ${modelo}`}
                          className="h-20 w-28 shrink-0 rounded object-cover ring-1 ring-carvao-200" />
                        <div className="min-w-0 text-xs text-carvao-500">
                          <p className="font-semibold text-carvao-950">
                            {marca} {modelo}{anoVeiculo ? ` ${anoVeiculo}` : ""}
                          </p>
                          <p className="mt-0.5">Imagem ilustrativa do modelo.</p>
                          <button type="button" onClick={() => setFoto(null)}
                            className="mt-1 font-semibold text-marca-600 hover:underline">
                            Nao usar esta foto
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoMascara rotulo="Placa" name="placa" placeholder="ABC1D23" required
                    mascara={mascararPlaca} dica="Aceita o padrao antigo e o Mercosul" />
                  <Campo rotulo="Marca" required value={marca}
                    onChange={(ev) => setMarca(ev.target.value)} />
                  <Campo rotulo="Modelo" required value={modelo}
                    onChange={(ev) => setModelo(ev.target.value)}
                    className="sm:col-span-2" />
                  <Campo rotulo="Ano" type="number" min={1900} max={2100} value={anoVeiculo}
                    onChange={(ev) => setAnoVeiculo(ev.target.value)} />
                  <Campo rotulo="Cor" name="cor" />
                  <CampoMascara rotulo="KM atual" name="km" className="sm:col-span-2"
                    mascara={mascararInteiro} limpar={soDigitos} inputMode="numeric" />
                </div>
                <AreaTexto rotulo="Observações do veículo" name="observacoes" rows={2}
                  placeholder="Avarias pré-existentes, particularidades..." />
                <Botao type="submit">Adicionar veículo</Botao>
              </form>
            )}

            {!criando && cliente && (
              <div className="border-t border-carvao-200 p-5">
                <dl className="grid grid-cols-2 gap-4">
                  <Dado rotulo="Telefone">{telefone(cliente.telefone)}</Dado>
                  <Dado rotulo="Cliente desde">{data(cliente.criadoEm)}</Dado>
                </dl>
              </div>
            )}
          </Cartao>
        )}

        {!criando && cliente && <Fidelidade clienteId={cliente.id} />}
      </div>
    </>
  );
}
