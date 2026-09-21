import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Aviso, Badge, Cartao, LinhaVazia, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { dataHora, numeroDoc } from "@/lib/format";
import { useEquipe } from "@/lib/equipe";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Avaria, Vistoria } from "@/lib/tipos";

type VistoriaNaLista = Vistoria & {
  ordens_servico: {
    numero: number;
    clientes: { nome: string } | null;
    veiculos: { marca: string; modelo: string; placa: string } | null;
  } | null;
};

export function Vistorias() {
  const { nome: nomeFuncionario } = useEquipe();
  const [linhas, setLinhas] = useState<VistoriaNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await sb
        .from("vistorias")
        .select(
          "*, ordens_servico(numero, clientes(nome), veiculos(marca, modelo, placa))",
        )
        .order("data", { ascending: false })
        .limit(100);
      if (!vivo) return;
      setErro(error ? mensagemErro(error) : null);
      setLinhas((data as VistoriaNaLista[]) ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <TituloPagina
        titulo="Vistorias"
        descricao="Laudos de entrada e saída. Cada vistoria é aberta a partir da sua ordem de serviço."
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th>OS</Th>
              <Th>Cliente / veículo</Th>
              <Th>Vistoriador</Th>
              <Th className="text-center">Avarias</Th>
              <Th className="text-center">Cliente conferiu</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhaVazia colunas={8} mensagem="Carregando..." />}
            {!carregando && linhas.length === 0 && (
              <LinhaVazia colunas={8}
                mensagem="Nenhuma vistoria registrada. Abra uma pela tela da ordem de serviço." />
            )}
            {linhas.map((v) => {
              const avarias = ((v.avarias ?? []) as Avaria[]).length;
              return (
                <tr key={v.id} className="hover:bg-carvao-50">
                  <Td className="whitespace-nowrap text-carvao-600">{dataHora(v.data)}</Td>
                  <Td>
                    <Badge cor={v.tipo === "ENTRADA"
                      ? "bg-blue-600 text-white" : "bg-carvao-950 text-white"}>
                      {v.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link to={`/sistema/ordens/${v.ordemId}`}
                      className="font-semibold text-marca-600 hover:underline">
                      {v.ordens_servico ? numeroDoc(v.ordens_servico.numero) : "—"}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium text-carvao-950">
                      {v.ordens_servico?.clientes?.nome ?? "—"}
                    </p>
                    <p className="text-xs text-carvao-500">
                      {v.ordens_servico?.veiculos?.marca} {v.ordens_servico?.veiculos?.modelo} ·{" "}
                      {v.ordens_servico?.veiculos?.placa}
                    </p>
                  </Td>
                  <Td className="text-carvao-600">{nomeFuncionario(v.funcionarioId)}</Td>
                  <Td className="text-center">
                    {avarias > 0
                      ? <Badge cor="bg-marca-600 text-white">{avarias}</Badge>
                      : <span className="text-carvao-400">—</span>}
                  </Td>
                  <Td className="text-center">
                    {v.aprovadaCliente
                      ? <Badge cor="bg-emerald-600 text-white">Sim</Badge>
                      : <span className="text-carvao-400">—</span>}
                  </Td>
                  <Td className="text-right">
                    <Link to={`/sistema/vistorias/${v.id}`}
                      className="text-sm font-semibold text-marca-600 hover:underline">
                      Ver laudo
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
