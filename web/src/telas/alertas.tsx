import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Check, MessageCircle, Plus, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, Campo, Cartao, CabecalhoCartao, Selecao, TituloPagina,
} from "@/componentes/ui";
import { TIPO_ALERTA } from "@/lib/constantes";
import { data, fimDoDia, inicioDoDia, linkWhatsapp, numeroDoc, somaDias } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Alerta, Cliente } from "@/lib/tipos";
import { BuscaSelecao } from "@/componentes/busca-selecao";

type AlertaNaTela = Alerta & {
  clientes: Pick<Cliente, "id" | "nome" | "telefone"> | null;
  veiculos: { placa: string } | null;
  ordens_servico: { id: string; numero: number } | null;
};

function CartaoAlerta({
  a, onConcluir, onAdiar, onCancelar, ocupado,
}: {
  a: AlertaNaTela;
  onConcluir: (id: string, resultado: string) => void;
  onAdiar: (id: string) => void;
  onCancelar: (id: string) => void;
  ocupado: boolean;
}) {
  const [concluindo, setConcluindo] = useState(false);
  const vencido = new Date(a.dataAlvo) < inicioDoDia() && a.status === "PENDENTE";
  const rotulo = TIPO_ALERTA[a.tipo];

  const zap = a.clientes
    ? linkWhatsapp(a.clientes.telefone,
        `Olá ${a.clientes.nome.split(" ")[0]}! Aqui é da World Car Service. ${
          a.tipo === "RETORNO_GARANTIA"
            ? "Estamos entrando em contato para agendar o retorno de revisão do serviço realizado no seu veículo."
            : a.tipo === "POS_VENDA"
              ? "Passando para saber se ficou tudo certo com o serviço no seu veículo."
              : "Estamos entrando em contato sobre o seu veículo."
        }`)
    : null;

  return (
    <li className={`rounded-lg border p-4 ${
      vencido ? "border-marca-300 bg-marca-50" : "border-carvao-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {vencido && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marca-600" aria-label="Vencido" />
            )}
            <p className="font-semibold text-carvao-950">{a.titulo}</p>
          </div>
          {a.descricao && <p className="mt-1 text-sm text-carvao-600">{a.descricao}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge cor={rotulo.cor}>{rotulo.label}</Badge>
            <span className={`text-xs ${vencido ? "font-semibold text-marca-600" : "text-carvao-500"}`}>
              {vencido ? "Venceu em " : "Para "}{data(a.dataAlvo)}
            </span>
            {a.ordens_servico && (
              <Link to={`/sistema/ordens/${a.ordens_servico.id}`}
                className="text-xs font-semibold text-marca-600 hover:underline">
                OS {numeroDoc(a.ordens_servico.numero)}
              </Link>
            )}
            {a.clientes && (
              <Link to={`/sistema/clientes/${a.clientes.id}`}
                className="text-xs font-semibold text-marca-600 hover:underline">
                {a.clientes.nome}
              </Link>
            )}
            {a.veiculos && (
              <Badge cor="bg-carvao-100 text-carvao-700">{a.veiculos.placa}</Badge>
            )}
          </div>
          {a.resultado && (
            <p className="mt-2 rounded border border-carvao-200 bg-carvao-50 px-3 py-2 text-xs text-carvao-700">
              <strong>Resultado:</strong> {a.resultado}
            </p>
          )}
        </div>

        {a.status === "PENDENTE" && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-carvao-300 bg-white px-3 py-1.5 text-xs font-semibold text-carvao-800 hover:border-carvao-500">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Contatar
              </a>
            )}
            <button type="button" onClick={() => setConcluindo((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-marca-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-600">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Concluir
            </button>
            <button type="button" onClick={() => onAdiar(a.id)} disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-md border border-carvao-300 bg-white px-3 py-1.5 text-xs font-semibold text-carvao-700 hover:border-carvao-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              +7 dias
            </button>
            <button type="button" onClick={() => onCancelar(a.id)} disabled={ocupado}
              className="rounded-md border border-carvao-300 bg-white p-1.5 text-carvao-500 hover:border-marca-300 hover:text-marca-600"
              aria-label="Cancelar alerta">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {concluindo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            onConcluir(a.id, String(f.get("resultado") ?? ""));
            setConcluindo(false);
          }}
          className="mt-3 space-y-2 rounded-md border border-carvao-200 bg-carvao-50 p-3"
        >
          <AreaTexto rotulo="O que aconteceu no contato?" name="resultado" rows={2}
            placeholder="Cliente agendou para sexta / sem retorno / disse que está tudo certo..." />
          <div className="flex gap-2">
            <Botao type="submit" className="px-3 py-1.5 text-xs">Registrar conclusão</Botao>
            <Botao type="button" variante="fantasma" className="px-3 py-1.5 text-xs"
              onClick={() => setConcluindo(false)}>Cancelar</Botao>
          </div>
        </form>
      )}
    </li>
  );
}

export function Alertas() {
  const [pendentes, setPendentes] = useState<AlertaNaTela[]>([]);
  const [concluidos, setConcluidos] = useState<AlertaNaTela[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, "id" | "nome">[]>([]);
  const [clienteAlerta, setClienteAlerta] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const incluir =
    "*, clientes(id, nome, telefone), veiculos(placa), ordens_servico(id, numero)";

  const carregar = useCallback(async () => {
    // A varredura de pendencias virou uma chamada explicita: no sistema
    // anterior ela rodava (com duas escritas!) a cada abertura da tela.
    await sb.rpc("sincronizar_pendencias");

    const [p, c, cl] = await Promise.all([
      sb.from("alertas").select(incluir).eq("status", "PENDENTE")
        .order("dataAlvo").limit(200),
      sb.from("alertas").select(incluir).eq("status", "CONCLUIDO")
        .order("concluidoEm", { ascending: false }).limit(10),
      sb.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    setErro(p.error ? mensagemErro(p.error) : null);
    setPendentes((p.data as AlertaNaTela[]) ?? []);
    setConcluidos((c.data as AlertaNaTela[]) ?? []);
    setClientes((cl.data as Pick<Cliente, "id" | "nome">[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function concluir(id: string, resultado: string) {
    setOcupado(true);
    await sb.from("alertas").update({
      status: "CONCLUIDO", concluidoEm: agora(), resultado: resultado.trim() || null,
    }).eq("id", id);
    setOcupado(false);
    await carregar();
  }

  async function adiar(id: string) {
    setOcupado(true);
    const alvo = pendentes.find((a) => a.id === id);
    if (alvo) {
      // Adia a partir de hoje, nao da data original, para nao seguir vencido
      const base = new Date(alvo.dataAlvo) > new Date() ? new Date(alvo.dataAlvo) : new Date();
      await sb.from("alertas")
        .update({ dataAlvo: somaDias(base, 7).toISOString() }).eq("id", id);
    }
    setOcupado(false);
    await carregar();
  }

  async function cancelar(id: string) {
    setOcupado(true);
    await sb.from("alertas").update({ status: "CANCELADO" }).eq("id", id);
    setOcupado(false);
    await carregar();
  }

  async function criarManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const f = new FormData(e.currentTarget);
    const dataAlvo = String(f.get("dataAlvo") ?? "");

    const { error } = await sb.from("alertas").insert({
      id: novoId(),
      tipo: String(f.get("tipo") ?? "RETORNO_MANUTENCAO"),
      titulo: String(f.get("titulo") ?? "").trim(),
      descricao: String(f.get("descricao") ?? "").trim() || null,
      dataAlvo: new Date(`${dataAlvo}T09:00:00`).toISOString(),
      clienteId: String(f.get("clienteId") ?? "") || null,
      criadoEm: agora(),
    });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setCriando(false);
    // O combobox guarda a escolha em estado proprio: fechar o formulario nao a
    // limpa sozinho, e o proximo alerta nasceria com o cliente anterior.
    setClienteAlerta("");
    await carregar();
  }

  const inicioHoje = inicioDoDia();
  const fimHoje = fimDoDia();
  const fimSemana = fimDoDia(somaDias(new Date(), 7));

  const grupos = [
    { titulo: "Vencidos", destaque: true,
      itens: pendentes.filter((a) => new Date(a.dataAlvo) < inicioHoje) },
    { titulo: "Para hoje", destaque: true,
      itens: pendentes.filter((a) => {
        const d = new Date(a.dataAlvo);
        return d >= inicioHoje && d <= fimHoje;
      }) },
    { titulo: "Próximos 7 dias",
      itens: pendentes.filter((a) => {
        const d = new Date(a.dataAlvo);
        return d > fimHoje && d <= fimSemana;
      }) },
    { titulo: "Mais adiante",
      itens: pendentes.filter((a) => new Date(a.dataAlvo) > fimSemana) },
  ];

  return (
    <>
      <TituloPagina
        titulo="Alertas"
        descricao="Retornos de garantia, pós-venda e lembretes. Gerados automaticamente ao entregar uma OS."
      />

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}

      <div className="space-y-6">
        <Cartao>
          <CabecalhoCartao
            titulo="Novo alerta manual"
            descricao="Para lembretes que o sistema não gera sozinho"
            acao={
              <Botao type="button" variante={criando ? "fantasma" : "primario"}
                onClick={() => setCriando((v) => !v)}>
                {criando ? "Fechar" : <><Plus className="h-4 w-4" aria-hidden />Criar alerta</>}
              </Botao>
            } />
          {criando && (
            <form onSubmit={criarManual} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-4">
                <Campo rotulo="Título" name="titulo" className="sm:col-span-2" required />
                <Selecao rotulo="Tipo" name="tipo" defaultValue="RETORNO_MANUTENCAO">
                  {Object.entries(TIPO_ALERTA).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Selecao>
                <Campo rotulo="Data do alerta" name="dataAlvo" type="date" required
                  defaultValue={new Date().toISOString().slice(0, 10)} />
                <BuscaSelecao rotulo="Cliente (opcional)" name="clienteId"
                  className="sm:col-span-2" valor={clienteAlerta}
                  opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                  placeholder="Sem cliente vinculado"
                  vazio="Nenhum cliente encontrado."
                  aoEscolher={setClienteAlerta} />
                <AreaTexto rotulo="Descrição" name="descricao" rows={2} className="sm:col-span-2" />
              </div>
              <Botao type="submit" disabled={ocupado}>Criar alerta</Botao>
            </form>
          )}
        </Cartao>

        {carregando && (
          <p className="py-8 text-center text-sm text-carvao-500">Carregando...</p>
        )}

        {!carregando && grupos.map((g) => g.itens.length === 0 ? null : (
          <section key={g.titulo}>
            <h2 className={`mb-3 font-display text-xl font-extrabold uppercase tracking-tight ${
              g.destaque ? "text-marca-600" : "text-carvao-950"}`}>
              {g.titulo}
              <span className="ml-2 text-sm font-semibold text-carvao-500">{g.itens.length}</span>
            </h2>
            <ul className="space-y-3">
              {g.itens.map((a) => (
                <CartaoAlerta key={a.id} a={a} ocupado={ocupado}
                  onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
              ))}
            </ul>
          </section>
        ))}

        {!carregando && pendentes.length === 0 && (
          <Cartao className="p-10 text-center">
            <p className="font-display text-xl font-bold uppercase text-carvao-950">
              Nenhum alerta pendente
            </p>
            <p className="mt-1 text-sm text-carvao-500">
              Retornos de garantia e pós-venda aparecem aqui quando uma OS é entregue.
            </p>
          </Cartao>
        )}

        {concluidos.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-xl font-extrabold uppercase tracking-tight text-carvao-500">
              Concluídos recentemente
            </h2>
            <ul className="space-y-3 opacity-70">
              {concluidos.map((a) => (
                <CartaoAlerta key={a.id} a={a} ocupado={ocupado}
                  onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
