import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Aviso, Badge, BotaoLink, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { STATUS_ORCAMENTO } from "@/lib/constantes";
import { brl, data, numeroDoc } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Orcamento, StatusOrcamento } from "@/lib/tipos";

type OrcamentoNaLista = Orcamento & {
  clientes: { nome: string } | null;
  veiculos: { marca: string; modelo: string; placa: string } | null;
  itens: { count: number }[];
};

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
  { valor: "ENVIADO", rotulo: "Enviados" },
  { valor: "APROVADO", rotulo: "Aprovados" },
  { valor: "RECUSADO", rotulo: "Recusados" },
  { valor: "EXPIRADO", rotulo: "Expirados" },
  { valor: "CONVERTIDO", rotulo: "Convertidos" },
];

export function Orcamentos() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [linhas, setLinhas] = useState<OrcamentoNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      setCarregando(true);
      let q = sb
        .from("orcamentos")
        .select(
          "*, clientes(nome), veiculos(marca, modelo, placa), itens:orcamento_itens(count)",
        )
        .order("criadoEm", { ascending: false })
        .limit(100);

      if (status) q = q.eq("status", status as StatusOrcamento);

      const { data: d, error } = await q;
      if (!vivo) return;
      setErro(error ? mensagemErro(error) : null);
      setLinhas((d as OrcamentoNaLista[]) ?? []);
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [status]);

  const hoje = new Date();

  return (
    <>
      <TituloPagina
        titulo="Orçamentos"
        descricao="Toda proposta gera um PDF com vias para loja, produção e cliente."
        acao={
          <BotaoLink to="/sistema/orcamentos/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo orçamento
          </BotaoLink>
        }
      />

      <nav aria-label="Filtrar por status" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.rotulo}
            type="button"
            onClick={() => setParams(f.valor ? { status: f.valor } : {})}
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
              status === f.valor
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </nav>

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Cliente / veículo</Th>
              <Th className="text-center">Itens</Th>
              <Th>Emissão</Th>
              <Th>Validade</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={7} mensagem="Carregando..." />}
            {!carregando && linhas.length === 0 && (
              <LinhaVazia colunas={7} mensagem="Nenhum orçamento nesse filtro." />
            )}
            {linhas.map((o) => {
              const validade = new Date(o.validoAte);
              const vencendo =
                validade >= hoje &&
                validade.getTime() - hoje.getTime() < 3 * 86400000 &&
                ["RASCUNHO", "ENVIADO"].includes(o.status);
              return (
                <tr key={o.id} className="hover:bg-carvao-50">
                  <Td>
                    <Link
                      to={`/sistema/orcamentos/${o.id}`}
                      className="font-semibold text-marca-600 hover:underline"
                    >
                      {numeroDoc(o.numero)}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">{o.clientes?.nome ?? "—"}</p>
                    <p className="text-xs text-carvao-500">
                      {o.veiculos?.marca} {o.veiculos?.modelo} · {o.veiculos?.placa}
                    </p>
                  </Td>
                  <Td className="text-center text-carvao-600">{o.itens?.[0]?.count ?? 0}</Td>
                  <Td className="whitespace-nowrap text-carvao-600">{data(o.criadoEm)}</Td>
                  <Td className="whitespace-nowrap">
                    <span className={vencendo ? "font-semibold text-marca-600" : "text-carvao-600"}>
                      {data(o.validoAte)}
                    </span>
                  </Td>
                  <Td>
                    <Badge cor={STATUS_ORCAMENTO[o.status].cor}>
                      {STATUS_ORCAMENTO[o.status].label}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-bold text-carvao-950">
                    {brl(o.total)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </Cartao>
    </>
  );
}
