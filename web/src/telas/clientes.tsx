import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import {
  Aviso, Badge, BotaoLink, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { data, documento, telefone } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Cliente } from "@/lib/tipos";
import { NIVEL_FIDELIDADE } from "@/lib/constantes";

type Fid = { clienteId: string; pontos: number; nivel: string; gasto12m: string };

type ClienteNaLista = Cliente & {
  veiculos: { placa: string }[];
  ordens: { count: number }[];
};

export function Clientes() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [clientes, setClientes] = useState<ClienteNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [fidelidade, setFidelidade] = useState<Map<string, Fid>>(new Map());

  useEffect(() => {
    let vivo = true;

    (async () => {
      setCarregando(true);
      let consulta = sb
        .from("clientes")
        .select("*, veiculos(placa), ordens:ordens_servico(count)")
        .order("nome")
        .limit(100);

      if (termo) {
        // `or` do PostgREST: nome, telefone, documento ou placa do veiculo
        const limpo = termo.replace(/[(),]/g, "");
        consulta = consulta.or(
          `nome.ilike.*${limpo}*,telefone.ilike.*${limpo}*,documento.ilike.*${limpo.replace(/\D/g, "")}*`,
        );
      }

      const { data: linhas, error } = await consulta;
      if (!vivo) return;
      if (error) setErro(mensagemErro(error));
      else setErro(null);
      const lista = (linhas as ClienteNaLista[]) ?? [];
      setClientes(lista);

      // Consulta separada: a view de fidelidade nao tem relacao declarada com
      // `clientes`, entao o PostgREST nao a embute — e somar o extrato de cem
      // clientes no navegador seria pior.
      if (lista.length > 0) {
        const { data: fid } = await sb.from("fidelidade_saldo")
          .select("*").in("clienteId", lista.map((c) => c.id));
        if (!vivo) return;
        setFidelidade(new Map(((fid as Fid[]) ?? []).map((f) => [f.clienteId, f])));
      } else {
        setFidelidade(new Map());
      }
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [termo]);

  function buscar(e: FormEvent) {
    e.preventDefault();
    setTermo(busca.trim());
  }

  return (
    <>
      <TituloPagina
        titulo="Clientes e veículos"
        descricao="Cadastro base para orçamentos e ordens de serviço."
        acao={
          <BotaoLink to="/sistema/clientes/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo cliente
          </BotaoLink>
        }
      />

      <Cartao className="mb-4 p-4">
        <form onSubmit={buscar} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carvao-400"
              aria-hidden
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
              aria-label="Buscar cliente"
              className="w-full rounded-md border border-carvao-300 py-2 pl-9 pr-3 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-carvao-950 px-5 text-sm font-semibold text-white hover:bg-carvao-800"
          >
            Buscar
          </button>
        </form>
      </Cartao>

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Contato</Th>
              <Th>Veículos</Th>
              <Th>Fidelidade</Th>
              <Th className="text-center">OS</Th>
              <Th>Cadastro</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={7} mensagem="Carregando..." />}
            {!carregando && clientes.length === 0 && (
              <LinhaVazia
                colunas={7}
                mensagem={
                  termo
                    ? `Nenhum cliente encontrado para "${termo}".`
                    : "Nenhum cliente cadastrado ainda."
                }
              />
            )}
            {clientes.map((c) => {
              const fid = fidelidade.get(c.id);
              const nivel = fid ? NIVEL_FIDELIDADE[fid.nivel] : null;
              return (
              <tr key={c.id} className="hover:bg-carvao-50">
                <Td>
                  <Link
                    to={`/sistema/clientes/${c.id}`}
                    className="font-semibold text-carvao-950 hover:text-marca-600"
                  >
                    {c.nome}
                  </Link>
                  <p className="text-xs text-carvao-500">
                    {c.tipo === "JURIDICA" ? "PJ" : "PF"}
                    {c.documento && ` · ${documento(c.documento)}`}
                  </p>
                </Td>
                <Td className="whitespace-nowrap">
                  <p>{telefone(c.telefone)}</p>
                  {c.email && <p className="text-xs text-carvao-500">{c.email}</p>}
                </Td>
                <Td>
                  {c.veiculos.length === 0 ? (
                    <span className="text-carvao-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.veiculos.slice(0, 3).map((v) => (
                        <Badge key={v.placa} cor="bg-carvao-100 text-carvao-700">
                          {v.placa}
                        </Badge>
                      ))}
                      {c.veiculos.length > 3 && (
                        <Badge cor="bg-carvao-100 text-carvao-500">
                          +{c.veiculos.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Td>
                <Td>
                  {nivel && Number(fid?.pontos ?? 0) > 0 ? (
                    <>
                      <Badge cor={nivel.cor}>{nivel.rotulo}</Badge>
                      <p className="mt-1 text-xs text-carvao-500">
                        {Number(fid?.pontos ?? 0).toLocaleString("pt-BR")} pontos
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-carvao-400">sem pontos</span>
                  )}
                </Td>
                <Td className="text-center font-semibold">
                  {c.ordens?.[0]?.count ?? 0}
                </Td>
                <Td className="whitespace-nowrap text-carvao-500">{data(c.criadoEm)}</Td>
                <Td className="text-right">
                  <Link
                    to={`/sistema/clientes/${c.id}`}
                    className="text-sm font-semibold text-marca-600 hover:underline"
                  >
                    Abrir
                  </Link>
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
