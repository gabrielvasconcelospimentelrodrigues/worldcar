import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Aviso, Badge, BotaoLink, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { STATUS_COTACAO } from "@/lib/constantes";
import { data, numeroDoc } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Cotacao, StatusCotacao } from "@/lib/tipos";

type CotacaoNaLista = Cotacao & {
  itens: { count: number }[];
  fornecedores: { count: number }[];
  ordens_servico: { id: string; numero: number } | null;
};

const FILTROS = [
  { valor: "", rotulo: "Todas" },
  { valor: "ABERTA", rotulo: "Aguardando" },
  { valor: "RESPONDIDA", rotulo: "Respondidas" },
  { valor: "DECIDIDA", rotulo: "Decididas" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
];

export function Cotacoes() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [linhas, setLinhas] = useState<CotacaoNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      let q = sb
        .from("cotacoes")
        .select(
          "*, itens:cotacao_itens(count), fornecedores:cotacao_fornecedores(count)," +
            " ordens_servico(id, numero)",
        )
        .order("criadoEm", { ascending: false })
        .limit(100);

      if (status) q = q.eq("status", status as StatusCotacao);

      const { data: d, error } = await q;
      if (!vivo) return;
      setErro(error ? mensagemErro(error) : null);
      setLinhas((d as unknown as CotacaoNaLista[]) ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [status]);

  return (
    <>
      <TituloPagina
        titulo="Cotações"
        descricao="Peça preço a vários fornecedores e compare lado a lado antes de comprar."
        acao={
          <BotaoLink to="/sistema/cotacoes/nova">
            <Plus className="h-4 w-4" aria-hidden />
            Nova cotação
          </BotaoLink>
        }
      />

      <nav aria-label="Filtrar cotações" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.rotulo} type="button"
            onClick={() => setParams(f.valor ? { status: f.valor } : {})}
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
              status === f.valor
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"
            }`}>
            {f.rotulo}
          </button>
        ))}
      </nav>

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Descrição</Th>
              <Th className="text-center">Itens</Th>
              <Th className="text-center">Fornecedores</Th>
              <Th>OS</Th>
              <Th>Aberta em</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={7} mensagem="Carregando..." />}
            {!carregando && linhas.length === 0 && (
              <LinhaVazia colunas={7}
                mensagem="Nenhuma cotação neste filtro. Abra uma para comparar preços." />
            )}
            {linhas.map((c) => (
              <tr key={c.id} className="hover:bg-carvao-50">
                <Td>
                  <Link to={`/sistema/cotacoes/${c.id}`}
                    className="font-semibold text-marca-600 hover:underline">
                    {numeroDoc(c.numero)}
                  </Link>
                </Td>
                <Td>
                  <p className="font-medium text-carvao-950">{c.descricao}</p>
                  {c.prazoResposta && (
                    <p className="text-xs text-carvao-500">
                      Resposta até {data(c.prazoResposta)}
                    </p>
                  )}
                </Td>
                <Td className="text-center text-carvao-600">{c.itens?.[0]?.count ?? 0}</Td>
                <Td className="text-center text-carvao-600">
                  {c.fornecedores?.[0]?.count ?? 0}
                </Td>
                <Td>
                  {c.ordens_servico ? (
                    <Link to={`/sistema/ordens/${c.ordens_servico.id}`}
                      className="text-sm font-semibold text-marca-600 hover:underline">
                      {numeroDoc(c.ordens_servico.numero)}
                    </Link>
                  ) : (
                    <span className="text-carvao-400">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-carvao-600">{data(c.criadoEm)}</Td>
                <Td>
                  <Badge cor={STATUS_COTACAO[c.status].cor}>
                    {STATUS_COTACAO[c.status].label}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
