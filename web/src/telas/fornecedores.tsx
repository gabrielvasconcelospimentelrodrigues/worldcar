import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Pencil, Plus, Search, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, LinhaVazia, Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { BlocoEndereco } from "@/componentes/bloco-endereco";
import { TIPO_FORNECEDOR } from "@/lib/constantes";
import { documento, linkWhatsapp, telefone } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Fornecedor } from "@/lib/tipos";
import { mascararDocumento, mascararTelefone, soDigitos } from "@/lib/mascaras";

export function Fornecedores() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await sb
      .from("fornecedores")
      .select("*")
      .order("ativo", { ascending: false })
      .order("nome");
    setErro(error ? mensagemErro(error) : null);
    setLista((data as Fornecedor[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const vazio = (k: string) => String(f.get(k) ?? "").trim() || null;
    const registro = {
      nome: String(f.get("nome") ?? "").trim(),
      razaoSocial: vazio("razaoSocial"),
      documento: vazio("documento")?.replace(/\D/g, "") ?? null,
      tipo: String(f.get("tipo") ?? "PECAS"),
      contato: vazio("contato"),
      telefone: vazio("telefone"),
      telefone2: vazio("telefone2"),
      email: vazio("email"),
      cep: vazio("cep"),
      endereco: vazio("endereco"),
      numero: vazio("numero"),
      bairro: vazio("bairro"),
      cidade: vazio("cidade"),
      uf: vazio("uf")?.toUpperCase() ?? null,
      prazoEntregaDias: Number(f.get("prazoEntregaDias")) || null,
      condicoesPagamento: vazio("condicoesPagamento"),
      observacoes: vazio("observacoes"),
      atualizadoEm: agora(),
    };

    const { error } = editando
      ? await sb.from("fornecedores").update(registro).eq("id", editando.id)
      : await sb.from("fornecedores").insert({ ...registro, id: novoId() });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setFormAberto(false);
    setEditando(null);
    await carregar();
  }

  async function alternarAtivo(f: Fornecedor) {
    setOcupado(true);
    await sb.from("fornecedores")
      .update({ ativo: !f.ativo, atualizadoEm: agora() }).eq("id", f.id);
    setOcupado(false);
    await carregar();
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? lista.filter((f) =>
        [f.nome, f.razaoSocial, f.contato, f.documento, f.cidade]
          .some((v) => v?.toLowerCase().includes(termo)))
    : lista;

  const ativos = lista.filter((f) => f.ativo).length;

  return (
    <>
      <TituloPagina
        titulo="Fornecedores"
        descricao="Quem abastece a oficina — peças, tintas, insumos e serviços terceirizados."
        acao={
          !formAberto && (
            <Botao type="button" onClick={() => { setEditando(null); setFormAberto(true); }}>
              <Plus className="h-4 w-4" aria-hidden />
              Novo fornecedor
            </Botao>
          )
        }
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      {formAberto && (
        <Cartao className="mb-6">
          <CabecalhoCartao
            titulo={editando ? `Editar: ${editando.nome}` : "Novo fornecedor"}
            acao={
              <button type="button"
                onClick={() => { setFormAberto(false); setEditando(null); }}
                className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                aria-label="Fechar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            } />
          <form key={editando?.id ?? "novo"} onSubmit={salvar} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-6">
              <Campo rotulo="Nome / Apelido" name="nome" required className="sm:col-span-3"
                defaultValue={editando?.nome ?? ""}
                placeholder="Como vocês chamam no dia a dia" />
              <Selecao rotulo="Tipo" name="tipo" className="sm:col-span-3"
                defaultValue={editando?.tipo ?? "PECAS"}>
                {Object.entries(TIPO_FORNECEDOR).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Selecao>
              <Campo rotulo="Razão social" name="razaoSocial" className="sm:col-span-4"
                defaultValue={editando?.razaoSocial ?? ""} />
              <CampoMascara rotulo="CNPJ / CPF" name="documento" className="sm:col-span-2"
                mascara={mascararDocumento} limpar={soDigitos} inputMode="numeric"
                defaultValue={editando?.documento ?? ""} placeholder="Somente números" />
              <Campo rotulo="Pessoa de contato" name="contato" className="sm:col-span-2"
                defaultValue={editando?.contato ?? ""} placeholder="Nome do vendedor" />
              <CampoMascara rotulo="Telefone / WhatsApp" name="telefone" className="sm:col-span-2"
                mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                defaultValue={editando?.telefone ?? ""} />
              <Campo rotulo="Telefone 2" name="telefone2" className="sm:col-span-2"
                defaultValue={editando?.telefone2 ?? ""} />
              <Campo rotulo="E-mail" name="email" type="email" className="sm:col-span-3"
                defaultValue={editando?.email ?? ""} />
              <Campo rotulo="Prazo médio de entrega (dias)" name="prazoEntregaDias"
                type="number" min={0} className="sm:col-span-3"
                defaultValue={editando?.prazoEntregaDias ?? ""} />
              <Campo rotulo="Condições de pagamento" name="condicoesPagamento"
                className="sm:col-span-6"
                defaultValue={editando?.condicoesPagamento ?? ""}
                placeholder="30 dias, boleto; à vista com 5% de desconto..." />
            </div>

            <BlocoEndereco
              titulo="Endereço do fornecedor"
              inicial={{
                cep: editando?.cep, endereco: editando?.endereco,
                numero: editando?.numero, bairro: editando?.bairro,
                cidade: editando?.cidade, uf: editando?.uf,
              }}
            />

            <AreaTexto rotulo="Observações" name="observacoes" rows={2}
              defaultValue={editando?.observacoes ?? ""}
              placeholder="Entrega só até as 16h, atende por WhatsApp, tem peça original..." />

            <div className="flex justify-end border-t border-carvao-200 pt-4">
              <Botao type="submit" disabled={ocupado}>
                {ocupado ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar fornecedor"}
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      <Cartao className="mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carvao-400"
            aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, contato, CNPJ ou cidade..."
            aria-label="Buscar fornecedor"
            className="w-full rounded-md border border-carvao-300 py-2 pl-9 pr-3 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20" />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Cadastrados"
          descricao={`${ativos} ativo(s) de ${lista.length}`} />
        <Tabela>
          <thead>
            <tr>
              <Th>Fornecedor</Th>
              <Th>Tipo</Th>
              <Th>Contato</Th>
              <Th>Condições</Th>
              <Th className="text-center">Prazo</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={6} mensagem="Carregando..." />}
            {!carregando && visiveis.length === 0 && (
              <LinhaVazia colunas={6}
                mensagem={termo
                  ? `Nenhum fornecedor para "${busca}".`
                  : "Nenhum fornecedor cadastrado. Cadastre para poder cotar preços."} />
            )}
            {visiveis.map((f) => (
              <tr key={f.id} className={f.ativo ? "hover:bg-carvao-50" : "opacity-50"}>
                <Td>
                  <p className="font-semibold text-carvao-950">{f.nome}</p>
                  <p className="text-xs text-carvao-500">
                    {f.documento ? documento(f.documento) : f.razaoSocial ?? "—"}
                    {f.cidade && ` · ${f.cidade}/${f.uf ?? ""}`}
                  </p>
                </Td>
                <Td>
                  <Badge cor="bg-carvao-100 text-carvao-700">{TIPO_FORNECEDOR[f.tipo]}</Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  {f.contato && <p className="text-carvao-800">{f.contato}</p>}
                  {f.telefone ? (
                    <a href={linkWhatsapp(f.telefone, `Olá! Aqui é da World Car Service.`)}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-marca-600 hover:underline">
                      <MessageCircle className="h-3 w-3" aria-hidden />
                      {telefone(f.telefone)}
                    </a>
                  ) : (
                    <span className="text-xs text-carvao-400">sem telefone</span>
                  )}
                </Td>
                <Td className="text-carvao-600">{f.condicoesPagamento ?? "—"}</Td>
                <Td className="text-center text-carvao-600">
                  {f.prazoEntregaDias ? `${f.prazoEntregaDias}d` : "—"}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button type="button"
                      onClick={() => { setEditando(f); setFormAberto(true); }}
                      className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                      aria-label={`Editar ${f.nome}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => void alternarAtivo(f)} disabled={ocupado}
                      className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100 hover:text-carvao-900">
                      {f.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
