import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Car, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { Aviso, Badge, Cartao, CabecalhoCartao, Indicador, TituloPagina } from "@/componentes/ui";
import { STATUS_OS } from "@/lib/constantes";
import { brl, data, num, numeroDoc } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao-contexto";
import type { Alerta, OrdemServico, ResumoPainel } from "@/lib/tipos";

type OrdemNaTela = OrdemServico & {
  clientes: { nome: string } | null;
  veiculos: { marca: string; modelo: string; placa: string } | null;
};

export function Painel() {
  const { eu, pode } = useSessao();
  const [resumo, setResumo] = useState<ResumoPainel | null>(null);
  const [ordens, setOrdens] = useState<OrdemNaTela[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // O painel inteiro em 3 idas ao banco: o resumo vem pronto de uma funcao
      // no Postgres, em vez das 9 consultas que o sistema antigo fazia.
      const [r, o, a] = await Promise.all([
        sb.rpc("resumo_painel"),
        sb
          .from("ordens_servico")
          .select("*, clientes(nome), veiculos(marca, modelo, placa)")
          .not("status", "in", "(ENTREGUE,CANCELADA)")
          .order("dataEntrada", { ascending: false })
          .limit(8),
        pode("alertas")
          ? sb
              .from("alertas")
              .select("*")
              .eq("status", "PENDENTE")
              .lte("dataAlvo", new Date().toISOString())
              .order("dataAlvo")
              .limit(8)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!vivo) return;
      const falha = r.error ?? o.error ?? a.error;
      if (falha) setErro(mensagemErro(falha));

      setResumo((r.data as ResumoPainel) ?? null);
      setOrdens((o.data as OrdemNaTela[]) ?? []);
      setAlertas((a.data as Alerta[]) ?? []);
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [pode]);

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const receita = num(resumo?.receita_mes);
  const despesa = num(resumo?.despesa_mes);
  const resultado = receita - despesa;

  return (
    <>
      <TituloPagina
        titulo={`Olá, ${eu?.nome.split(" ")[0] ?? ""}`}
        descricao="Visão geral da oficina hoje."
      />

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Veículos na oficina"
          valor={carregando ? "—" : String(resumo?.os_ativas ?? 0)}
          detalhe="OS aguardando, em andamento ou pausadas"
          icone={<Car className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Prontos para retirada"
          valor={carregando ? "—" : String(resumo?.os_prontas ?? 0)}
          detalhe="Avisar o cliente"
          destaque={(resumo?.os_prontas ?? 0) > 0}
        />
        <Indicador
          rotulo="Orçamentos em aberto"
          valor={carregando ? "—" : String(resumo?.orcamentos_abertos ?? 0)}
          detalhe="Rascunho ou enviado"
          icone={<FileText className="h-5 w-5" aria-hidden />}
        />
        <Indicador
          rotulo="Alertas para hoje"
          valor={carregando ? "—" : String(resumo?.alertas_hoje ?? 0)}
          detalhe="Retornos e pós-venda"
          destaque={(resumo?.alertas_hoje ?? 0) > 0}
          icone={<BellRing className="h-5 w-5" aria-hidden />}
        />
      </div>

      {pode("financeiro") && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo={`Receita de ${mes}`}
            valor={brl(receita)}
            detalhe="Recebimentos confirmados"
            icone={<TrendingUp className="h-5 w-5" aria-hidden />}
          />
          <Indicador
            rotulo={`Despesa de ${mes}`}
            valor={brl(despesa)}
            detalhe="Pagamentos efetuados"
            icone={<TrendingDown className="h-5 w-5" aria-hidden />}
          />
          <Indicador
            rotulo="Resultado do mês"
            valor={brl(resultado)}
            detalhe={resultado >= 0 ? "No azul" : "No vermelho"}
            destaque={resultado < 0}
          />
          <Indicador
            rotulo="A receber"
            valor={brl(resumo?.a_receber)}
            detalhe="Pendente + atrasado"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Cartao>
          <CabecalhoCartao
            titulo="Na oficina agora"
            descricao="Ordens de serviço em aberto"
            acao={
              <Link
                to="/sistema/ordens"
                className="text-sm font-semibold text-marca-600 hover:text-marca-700"
              >
                Ver todas
              </Link>
            }
          />
          <ul className="divide-y divide-carvao-100">
            {!carregando && ordens.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-carvao-500">
                Nenhum veículo em serviço.
              </li>
            )}
            {ordens.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-carvao-900">
                    {numeroDoc(o.numero)} · {o.clientes?.nome ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-carvao-500">
                    {o.veiculos?.marca} {o.veiculos?.modelo} · {o.veiculos?.placa} ·{" "}
                    {data(o.dataEntrada)}
                  </p>
                </div>
                <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Cartao>

        {pode("alertas") && (
          <Cartao>
            <CabecalhoCartao
              titulo="Alertas de hoje"
              acao={
                <Link
                  to="/sistema/alertas"
                  className="text-sm font-semibold text-marca-600 hover:text-marca-700"
                >
                  Ver todos
                </Link>
              }
            />
            <ul className="divide-y divide-carvao-100">
              {!carregando && alertas.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-carvao-500">
                  Nenhum alerta pendente. Tudo em dia.
                </li>
              )}
              {alertas.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <p className="truncate text-sm font-medium text-carvao-900">{a.titulo}</p>
                  <p className="mt-1 text-xs text-carvao-500">{data(a.dataAlvo)}</p>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
    </>
  );
}
