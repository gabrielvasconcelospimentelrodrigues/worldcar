"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { StatusAlerta, TipoAlerta } from "@prisma/client";
import { AlertTriangle, CalendarClock, Check, MessageCircle, Plus, X } from "lucide-react";
import {
  AreaTexto,
  Aviso,
  Badge,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  Selecao,
} from "@/components/ui";
import { TIPO_ALERTA } from "@/lib/constantes";
import { data, linkWhatsapp, numeroDoc } from "@/lib/format";
import {
  adiarAlertaAction,
  cancelarAlertaAction,
  concluirAlertaAction,
  criarAlertaAction,
  type Estado,
} from "./actions";

export type AlertaItem = {
  id: string;
  tipo: TipoAlerta;
  status: StatusAlerta;
  titulo: string;
  descricao: string | null;
  dataAlvo: Date;
  resultado: string | null;
  cliente: { id: string; nome: string; telefone: string } | null;
  veiculo: { placa: string } | null;
  ordem: { id: string; numero: number } | null;
};

function CartaoAlerta({ a }: { a: AlertaItem }) {
  const [concluindo, setConcluindo] = useState(false);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencido = a.dataAlvo < hoje && a.status === "PENDENTE";
  const rotulo = TIPO_ALERTA[a.tipo];

  const zap = a.cliente
    ? linkWhatsapp(
        a.cliente.telefone,
        `Olá ${a.cliente.nome.split(" ")[0]}! Aqui é da World Car Service. ${
          a.tipo === "RETORNO_GARANTIA"
            ? "Estamos entrando em contato para agendar o retorno de revisão do serviço realizado no seu veículo."
            : a.tipo === "POS_VENDA"
              ? "Passando para saber se ficou tudo certo com o serviço no seu veículo."
              : "Estamos entrando em contato sobre o seu veículo."
        }`,
      )
    : null;

  return (
    <li
      className={`rounded-lg border p-4 ${
        vencido ? "border-marca-300 bg-marca-50" : "border-carvao-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {vencido && (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-marca-600"
                aria-label="Vencido"
              />
            )}
            <p className="font-semibold text-carvao-950">{a.titulo}</p>
          </div>
          {a.descricao && (
            <p className="mt-1 text-sm text-carvao-600">{a.descricao}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge cor={rotulo.cor}>{rotulo.label}</Badge>
            <span
              className={`text-xs ${
                vencido ? "font-semibold text-marca-600" : "text-carvao-500"
              }`}
            >
              {vencido ? "Venceu em " : "Para "}
              {data(a.dataAlvo)}
            </span>
            {a.ordem && (
              <Link
                href={`/sistema/ordens/${a.ordem.id}`}
                className="text-xs font-semibold text-marca-600 hover:underline"
              >
                OS {numeroDoc(a.ordem.numero)}
              </Link>
            )}
            {a.cliente && (
              <Link
                href={`/sistema/clientes/${a.cliente.id}`}
                className="text-xs font-semibold text-marca-600 hover:underline"
              >
                {a.cliente.nome}
              </Link>
            )}
            {a.veiculo && (
              <Badge cor="bg-carvao-100 text-carvao-700">{a.veiculo.placa}</Badge>
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
              <a
                href={zap}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-carvao-300 bg-white px-3 py-1.5 text-xs font-semibold text-carvao-800 hover:border-carvao-500"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Contatar
              </a>
            )}
            <button
              type="button"
              onClick={() => setConcluindo((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-marca-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-600"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Concluir
            </button>
            <form action={adiarAlertaAction}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="dias" value={7} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-carvao-300 bg-white px-3 py-1.5 text-xs font-semibold text-carvao-700 hover:border-carvao-500"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                +7 dias
              </button>
            </form>
            <form action={cancelarAlertaAction}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="rounded-md border border-carvao-300 bg-white p-1.5 text-carvao-500 hover:border-marca-300 hover:text-marca-600"
                aria-label="Cancelar alerta"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </form>
          </div>
        )}
      </div>

      {concluindo && (
        <form
          action={concluirAlertaAction}
          className="mt-3 space-y-2 rounded-md border border-carvao-200 bg-carvao-50 p-3"
        >
          <input type="hidden" name="id" value={a.id} />
          <AreaTexto
            rotulo="O que aconteceu no contato?"
            name="resultado"
            rows={2}
            placeholder="Cliente agendou para sexta / sem retorno / disse que está tudo certo..."
          />
          <div className="flex gap-2">
            <Botao type="submit" className="px-3 py-1.5 text-xs">
              Registrar conclusão
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              className="px-3 py-1.5 text-xs"
              onClick={() => setConcluindo(false)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      )}
    </li>
  );
}

export function ListaAlertas({
  vencidos,
  hoje,
  proximos,
  futuros,
  concluidos,
  clientes,
}: {
  vencidos: AlertaItem[];
  hoje: AlertaItem[];
  proximos: AlertaItem[];
  futuros: AlertaItem[];
  concluidos: AlertaItem[];
  clientes: { id: string; nome: string }[];
}) {
  const [criando, setCriando] = useState(false);
  const [estado, acao] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await criarAlertaAction(prev, dados);
      if (r.ok) setCriando(false);
      return r;
    },
    {},
  );

  const grupos: { titulo: string; itens: AlertaItem[]; destaque?: boolean }[] = [
    { titulo: "Vencidos", itens: vencidos, destaque: true },
    { titulo: "Para hoje", itens: hoje, destaque: true },
    { titulo: "Próximos 7 dias", itens: proximos },
    { titulo: "Mais adiante", itens: futuros },
  ];

  return (
    <div className="space-y-6">
      <Cartao>
        <CabecalhoCartao
          titulo="Novo alerta manual"
          descricao="Para lembretes que o sistema não gera sozinho"
          acao={
            <Botao
              type="button"
              variante={criando ? "fantasma" : "primario"}
              onClick={() => setCriando((v) => !v)}
            >
              {criando ? (
                "Fechar"
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden />
                  Criar alerta
                </>
              )}
            </Botao>
          }
        />
        {criando && (
          <form action={acao} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Campo rotulo="Título" name="titulo" className="sm:col-span-2" required />
              <Selecao rotulo="Tipo" name="tipo" defaultValue="RETORNO_MANUTENCAO">
                {Object.entries(TIPO_ALERTA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Selecao>
              <Campo
                rotulo="Data do alerta"
                name="dataAlvo"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
              <Selecao rotulo="Cliente (opcional)" name="clienteId" className="sm:col-span-2">
                <option value="">Sem cliente vinculado</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
              <AreaTexto
                rotulo="Descrição"
                name="descricao"
                rows={2}
                className="sm:col-span-2"
              />
            </div>
            {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
            <Botao type="submit">Criar alerta</Botao>
          </form>
        )}
      </Cartao>

      {grupos.map((g) =>
        g.itens.length === 0 ? null : (
          <section key={g.titulo}>
            <h2
              className={`mb-3 font-display text-xl font-extrabold uppercase tracking-tight ${
                g.destaque ? "text-marca-600" : "text-carvao-950"
              }`}
            >
              {g.titulo}
              <span className="ml-2 text-sm font-semibold text-carvao-500">
                {g.itens.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {g.itens.map((a) => (
                <CartaoAlerta key={a.id} a={a} />
              ))}
            </ul>
          </section>
        ),
      )}

      {vencidos.length + hoje.length + proximos.length + futuros.length === 0 && (
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
              <CartaoAlerta key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
