import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, LinhaVazia, Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { CATEGORIA_SERVICO } from "@/lib/constantes";
import { brl, num } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Servico } from "@/lib/tipos";
import { dinheiroParaNumero, mascararDinheiro } from "@/lib/mascaras";

export function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Servico | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    const { data, error } = await sb
      .from("servicos")
      .select("*")
      .order("ativo", { ascending: false })
      .order("categoria")
      .order("nome");
    if (error) setErro(mensagemErro(error));
    setServicos((data as Servico[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    void recarregar();
  }, []);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const f = new FormData(e.currentTarget);
    const registro = {
      codigo: String(f.get("codigo") ?? "").trim().toUpperCase(),
      nome: String(f.get("nome") ?? "").trim(),
      descricao: String(f.get("descricao") ?? "").trim() || null,
      categoria: String(f.get("categoria") ?? "OUTROS"),
      preco: Number(f.get("preco") ?? 0),
      custo: Number(f.get("custo") ?? 0),
      duracaoMin: Number(f.get("duracaoMin") ?? 60),
      garantiaDias: Number(f.get("garantiaDias") ?? 0),
      comissaoPct: Number(f.get("comissaoPct") ?? 0),
    };

    const { error } = editando
      ? await sb.from("servicos").update(registro).eq("id", editando.id)
      : await sb.from("servicos").insert({ ...registro, id: crypto.randomUUID() });

    setSalvando(false);
    if (error) {
      setErro(mensagemErro(error));
      return;
    }
    setFormAberto(false);
    setEditando(null);
    await recarregar();
  }

  async function alternarAtivo(s: Servico) {
    const { error } = await sb
      .from("servicos")
      .update({ ativo: !s.ativo })
      .eq("id", s.id);
    if (error) setErro(mensagemErro(error));
    await recarregar();
  }

  return (
    <>
      <TituloPagina
        titulo="Catálogo de serviços"
        descricao="Preço, prazo, garantia e comissão de cada serviço. É a base dos orçamentos."
      />

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      {formAberto && (
        <Cartao className="mb-6">
          <CabecalhoCartao
            titulo={editando ? `Editar: ${editando.nome}` : "Novo serviço"}
            acao={
              <button
                type="button"
                onClick={() => {
                  setFormAberto(false);
                  setEditando(null);
                }}
                className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                aria-label="Fechar formulário"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          <form key={editando?.id ?? "novo"} onSubmit={salvar} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-6">
              <Campo
                rotulo="Código" name="codigo" required
                defaultValue={editando?.codigo ?? ""} placeholder="EST-01"
              />
              <Campo
                rotulo="Nome do serviço" name="nome" required
                defaultValue={editando?.nome ?? ""} className="sm:col-span-3"
              />
              <Selecao
                rotulo="Categoria" name="categoria" className="sm:col-span-2"
                defaultValue={editando?.categoria ?? "ESTETICA"}
              >
                {Object.entries(CATEGORIA_SERVICO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Selecao>
            </div>

            <AreaTexto
              rotulo="Descrição" name="descricao" rows={2}
              defaultValue={editando?.descricao ?? ""}
              placeholder="O que está incluso (aparece no PDF do orçamento)."
            />

            <div className="grid gap-4 sm:grid-cols-5">
              <CampoMascara rotulo="Preço (R$)" name="preco"
                mascara={mascararDinheiro} limpar={(v) => String(dinheiroParaNumero(v))}
                inputMode="decimal"
                required defaultValue={editando ? num(editando.preco) : ""} />
              <Campo rotulo="Custo (R$)" name="custo" type="number" step="0.01" min={0}
                defaultValue={editando ? num(editando.custo) : 0} dica="Material/insumo" />
              <Campo rotulo="Duração (min)" name="duracaoMin" type="number" min={0}
                defaultValue={editando?.duracaoMin ?? 60} />
              <Campo rotulo="Garantia (dias)" name="garantiaDias" type="number" min={0}
                defaultValue={editando?.garantiaDias ?? 0} dica="Gera alerta de retorno" />
              <Campo rotulo="Comissão (%)" name="comissaoPct" type="number" step="0.01"
                min={0} max={100} defaultValue={editando ? num(editando.comissaoPct) : 0} />
            </div>

            <div className="flex justify-end border-t border-carvao-200 pt-4">
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar serviço"}
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao
          titulo="Catálogo"
          descricao={`${servicos.length} serviço(s)`}
          acao={
            !formAberto && (
              <Botao
                type="button"
                onClick={() => {
                  setEditando(null);
                  setFormAberto(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Novo serviço
              </Botao>
            )
          }
        />
        <Tabela>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Serviço</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Preço</Th>
              <Th className="text-center">Duração</Th>
              <Th className="text-center">Garantia</Th>
              <Th className="text-center">Comissão</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={8} mensagem="Carregando..." />}
            {!carregando && servicos.length === 0 && (
              <LinhaVazia colunas={8} mensagem="Nenhum serviço cadastrado." />
            )}
            {servicos.map((s) => (
              <tr key={s.id} className={s.ativo ? "hover:bg-carvao-50" : "opacity-50"}>
                <Td className="font-mono text-xs font-semibold">{s.codigo}</Td>
                <Td>
                  <p className="font-medium text-carvao-950">{s.nome}</p>
                  {s.descricao && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-carvao-500">{s.descricao}</p>
                  )}
                </Td>
                <Td>
                  <Badge cor="bg-carvao-100 text-carvao-700">
                    {CATEGORIA_SERVICO[s.categoria]}
                  </Badge>
                </Td>
                <Td className="text-right font-semibold">{brl(s.preco)}</Td>
                <Td className="text-center text-carvao-600">{s.duracaoMin} min</Td>
                <Td className="text-center text-carvao-600">
                  {s.garantiaDias > 0 ? `${s.garantiaDias}d` : "—"}
                </Td>
                <Td className="text-center text-carvao-600">
                  {num(s.comissaoPct) > 0 ? `${num(s.comissaoPct)}%` : "—"}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(s);
                        setFormAberto(true);
                      }}
                      className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                      aria-label={`Editar ${s.nome}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void alternarAtivo(s)}
                      className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100 hover:text-carvao-900"
                    >
                      {s.ativo ? "Desativar" : "Ativar"}
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
