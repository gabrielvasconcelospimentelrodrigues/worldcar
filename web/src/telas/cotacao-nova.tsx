import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, CabecalhoCartao, Selecao, TituloPagina,
} from "@/componentes/ui";
import { numeroDoc } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { useSessao } from "@/lib/sessao-contexto";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Fornecedor, OrdemServico } from "@/lib/tipos";

type OrdemAberta = Pick<OrdemServico, "id" | "numero"> & {
  clientes: { nome: string } | null;
  veiculos: { placa: string } | null;
};

export function NovaCotacao() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { eu } = useSessao();

  const [ordens, setOrdens] = useState<OrdemAberta[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [o, f] = await Promise.all([
        sb.from("ordens_servico")
          .select("id, numero, clientes(nome), veiculos(placa)")
          .not("status", "in", "(ENTREGUE,CANCELADA)")
          .order("numero", { ascending: false }).limit(50),
        sb.from("fornecedores").select("*").eq("ativo", true).order("nome"),
      ]);
      if (!vivo) return;
      setOrdens((o.data as unknown as OrdemAberta[]) ?? []);
      setFornecedores((f.data as Fornecedor[]) ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const f = new FormData(e.currentTarget);
    const prazo = String(f.get("prazoResposta") ?? "");
    const id = novoId();

    const { error } = await sb.from("cotacoes").insert({
      id,
      descricao: String(f.get("descricao") ?? "").trim(),
      ordemId: String(f.get("ordemId") ?? "") || null,
      solicitanteId: eu?.id ?? null,
      prazoResposta: prazo ? new Date(`${prazo}T18:00:00`).toISOString() : null,
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
      atualizadoEm: agora(),
    });

    if (error) { setSalvando(false); return setErro(mensagemErro(error)); }

    if (escolhidos.length > 0) {
      await sb.from("cotacao_fornecedores").insert(
        escolhidos.map((fornecedorId) => ({
          id: novoId(), cotacaoId: id, fornecedorId,
        })),
      );
    }

    setSalvando(false);
    navegar(`/sistema/cotacoes/${id}`);
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <>
      <TituloPagina
        titulo="Nova cotação"
        descricao="Depois de criar você adiciona os itens e lança os preços de cada fornecedor."
      />

      {fornecedores.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Nenhum fornecedor ativo cadastrado. Cadastre ao menos dois para a comparação
            fazer sentido.
          </Aviso>
        </div>
      )}

      <form onSubmit={criar} className="space-y-6">
        <Cartao>
          <CabecalhoCartao titulo="Do que se trata" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo rotulo="Descrição" name="descricao" required className="sm:col-span-2"
              placeholder="Peças do Corolla da Marina, tintas para o mês, insumos de estética..." />
            <Selecao rotulo="Ordem de serviço (opcional)" name="ordemId"
              dica="Vincule quando a compra é para um veículo específico"
              defaultValue={params.get("ordem") ?? ""}>
              <option value="">Compra avulsa</option>
              {ordens.map((o) => (
                <option key={o.id} value={o.id}>
                  OS {numeroDoc(o.numero)} — {o.clientes?.nome} ({o.veiculos?.placa})
                </option>
              ))}
            </Selecao>
            <Campo rotulo="Prazo para resposta" name="prazoResposta" type="date"
              min={new Date().toISOString().slice(0, 10)} />
            <AreaTexto rotulo="Observações" name="observacoes" rows={2}
              className="sm:col-span-2"
              placeholder="Condições, urgência, exigências de qualidade..." />
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Quem vai cotar"
            descricao={`${escolhidos.length} de ${fornecedores.length} selecionado(s)`} />
          {fornecedores.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-carvao-500">
              Nenhum fornecedor ativo.
            </p>
          ) : (
            <ul className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {fornecedores.map((f) => {
                const marcado = escolhidos.includes(f.id);
                return (
                  <li key={f.id}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                      marcado
                        ? "border-marca-500 bg-marca-50"
                        : "border-carvao-200 hover:border-carvao-400"}`}>
                      <input type="checkbox" checked={marcado}
                        onChange={() => setEscolhidos((e) =>
                          marcado ? e.filter((x) => x !== f.id) : [...e, f.id])}
                        className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-carvao-950">
                          {f.nome}
                        </span>
                        <span className="block truncate text-xs text-carvao-500">
                          {f.contato ?? f.cidade ?? "—"}
                          {f.prazoEntregaDias && ` · ${f.prazoEntregaDias}d`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex justify-end">
          <Botao type="submit" disabled={salvando} className="px-6 py-2.5">
            {salvando ? "Criando..." : "Criar cotação"}
          </Botao>
        </div>
      </form>
    </>
  );
}
