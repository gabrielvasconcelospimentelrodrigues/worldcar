"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { TipoVistoria } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
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
import { CampoAssinatura } from "@/components/ui/assinatura";
import {
  CHECKLIST_VISTORIA,
  ESTADO_VISTORIA,
  NIVEIS_COMBUSTIVEL,
  type EstadoItemVistoria,
} from "@/lib/constantes";
import { salvarVistoriaAction, type Estado } from "../actions";

type Funcionario = { id: string; nome: string; cargo: string };

type Avaria = { chave: string; local: string; descricao: string; gravidade: string };

const GRAVIDADES = ["Leve", "Média", "Grave"];

const LOCAIS = [
  "Para-choque dianteiro",
  "Para-choque traseiro",
  "Capô",
  "Teto",
  "Porta-malas",
  "Porta dianteira direita",
  "Porta traseira direita",
  "Porta dianteira esquerda",
  "Porta traseira esquerda",
  "Paralama direito",
  "Paralama esquerdo",
  "Parabrisa",
  "Vidro lateral",
  "Retrovisor",
  "Farol / lanterna",
  "Roda",
  "Interior",
];

function Enviar({ tipo }: { tipo: TipoVistoria }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="px-6 py-2.5">
      {pending
        ? "Salvando..."
        : `Registrar vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
    </Botao>
  );
}

export function FormularioVistoria({
  ordem,
  tipo,
  funcionarios,
  vistoriaExistente,
}: {
  ordem: {
    id: string;
    numero: number;
    cliente: string;
    veiculo: string;
    placa: string;
    km: number | null;
  };
  tipo: TipoVistoria;
  funcionarios: Funcionario[];
  vistoriaExistente?: {
    funcionarioId: string;
    km: number | null;
    combustivel: string | null;
    checklist: Record<string, EstadoItemVistoria>;
    avarias: { local: string; descricao: string; gravidade: string }[];
    pertences: string | null;
    observacoes: string | null;
    aprovadaCliente: boolean;
    assinaturaCliente: string | null;
  };
}) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarVistoriaAction, {});

  const [checklist, setChecklist] = useState<Record<string, EstadoItemVistoria>>(
    () => vistoriaExistente?.checklist ?? {},
  );
  const [avarias, setAvarias] = useState<Avaria[]>(() =>
    (vistoriaExistente?.avarias ?? []).map((a) => ({
      chave: Math.random().toString(36).slice(2, 10),
      ...a,
    })),
  );

  const totalItens = useMemo(
    () => CHECKLIST_VISTORIA.reduce((s, g) => s + g.itens.length, 0),
    [],
  );
  const preenchidos = Object.keys(checklist).length;

  const marcarGrupo = (itens: string[], valor: EstadoItemVistoria) =>
    setChecklist((c) => {
      const novo = { ...c };
      for (const i of itens) novo[i] = valor;
      return novo;
    });

  return (
    <form action={acao} className="space-y-6">
      <input type="hidden" name="ordemId" value={ordem.id} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="checklist" value={JSON.stringify(checklist)} />
      <input
        type="hidden"
        name="avarias"
        value={JSON.stringify(
          avarias
            .filter((a) => a.local)
            .map(({ local, descricao, gravidade }) => ({ local, descricao, gravidade })),
        )}
      />

      {/* Identificacao */}
      <Cartao>
        <CabecalhoCartao
          titulo={`Vistoria de ${tipo === "ENTRADA" ? "entrada" : "saída"}`}
          descricao={`OS ${ordem.numero} · ${ordem.cliente} · ${ordem.veiculo} (${ordem.placa})`}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Selecao
            rotulo="Vistoriador"
            name="funcionarioId"
            defaultValue={vistoriaExistente?.funcionarioId ?? ""}
            required
          >
            <option value="">Selecione...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} — {f.cargo}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="KM"
            name="km"
            type="number"
            min={0}
            defaultValue={vistoriaExistente?.km ?? ordem.km ?? ""}
          />
          <Selecao
            rotulo="Nível de combustível"
            name="combustivel"
            defaultValue={vistoriaExistente?.combustivel ?? ""}
          >
            <option value="">Não informado</option>
            {NIVEIS_COMBUSTIVEL.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Selecao>
        </div>
      </Cartao>

      {/* Checklist */}
      <Cartao>
        <CabecalhoCartao
          titulo="Checklist"
          descricao={`${preenchidos} de ${totalItens} itens conferidos`}
        />
        <div className="divide-y divide-carvao-100">
          {CHECKLIST_VISTORIA.map((grupo) => (
            <fieldset key={grupo.grupo} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <legend className="font-display text-base font-bold uppercase tracking-tight text-carvao-950">
                  {grupo.grupo}
                </legend>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => marcarGrupo(grupo.itens, "OK")}
                    className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Tudo OK
                  </button>
                  <button
                    type="button"
                    onClick={() => marcarGrupo(grupo.itens, "NA")}
                    className="rounded border border-carvao-300 px-2.5 py-1 text-xs font-semibold text-carvao-600 hover:bg-carvao-50"
                  >
                    Tudo N/A
                  </button>
                </div>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.itens.map((item) => {
                  const atual = checklist[item];
                  return (
                    <li
                      key={item}
                      className="flex items-center justify-between gap-2 rounded-md border border-carvao-200 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-carvao-800">
                        {item}
                      </span>
                      <div
                        role="radiogroup"
                        aria-label={item}
                        className="flex shrink-0 gap-1"
                      >
                        {(["OK", "AVARIA", "NA"] as EstadoItemVistoria[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={atual === v}
                            onClick={() =>
                              setChecklist((c) => ({ ...c, [item]: v }))
                            }
                            className={`rounded px-2 py-1 text-[10px] font-bold transition ${
                              atual === v
                                ? ESTADO_VISTORIA[v].cor
                                : "bg-carvao-100 text-carvao-500 hover:bg-carvao-200"
                            }`}
                          >
                            {ESTADO_VISTORIA[v].label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </Cartao>

      {/* Avarias */}
      <Cartao>
        <CabecalhoCartao
          titulo="Avarias encontradas"
          descricao="Registre riscos, amassados e trincas com localização"
          acao={
            <Botao
              type="button"
              variante="fantasma"
              onClick={() =>
                setAvarias((a) => [
                  ...a,
                  {
                    chave: Math.random().toString(36).slice(2, 10),
                    local: "",
                    descricao: "",
                    gravidade: "Leve",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar avaria
            </Botao>
          }
        />
        {avarias.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carvao-500">
            Nenhuma avaria registrada.
          </p>
        ) : (
          <ul className="divide-y divide-carvao-100">
            {avarias.map((a, idx) => (
              <li key={a.chave} className="grid gap-3 p-5 sm:grid-cols-12">
                <Selecao
                  rotulo="Local"
                  value={a.local}
                  onChange={(e) =>
                    setAvarias((ls) =>
                      ls.map((x) =>
                        x.chave === a.chave ? { ...x, local: e.target.value } : x,
                      ),
                    )
                  }
                  className="sm:col-span-4"
                >
                  <option value="">Selecione...</option>
                  {LOCAIS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Selecao>
                <Campo
                  rotulo="Descrição"
                  value={a.descricao}
                  onChange={(e) =>
                    setAvarias((ls) =>
                      ls.map((x) =>
                        x.chave === a.chave ? { ...x, descricao: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Risco de 10 cm, amassado leve..."
                  className="sm:col-span-5"
                />
                <Selecao
                  rotulo="Gravidade"
                  value={a.gravidade}
                  onChange={(e) =>
                    setAvarias((ls) =>
                      ls.map((x) =>
                        x.chave === a.chave ? { ...x, gravidade: e.target.value } : x,
                      ),
                    )
                  }
                  className="sm:col-span-2"
                >
                  {GRAVIDADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Selecao>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() =>
                      setAvarias((ls) => ls.filter((x) => x.chave !== a.chave))
                    }
                    className="mb-1 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                    aria-label={`Remover avaria ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* Fechamento */}
      <Cartao>
        <CabecalhoCartao titulo="Complementos" />
        <div className="space-y-4 p-5">
          <AreaTexto
            rotulo="Pertences deixados no veículo"
            name="pertences"
            rows={2}
            defaultValue={vistoriaExistente?.pertences ?? ""}
            placeholder="Documentos, cadeirinha, ferramentas, som..."
          />
          <AreaTexto
            rotulo="Observações gerais"
            name="observacoes"
            rows={3}
            defaultValue={vistoriaExistente?.observacoes ?? ""}
          />
          <label className="flex items-start gap-3 rounded-md border border-carvao-200 bg-carvao-50 p-4">
            <input
              type="checkbox"
              name="aprovadaCliente"
              defaultChecked={vistoriaExistente?.aprovadaCliente}
              className="mt-0.5 h-4 w-4 accent-[var(--color-marca-500)]"
            />
            <span className="text-sm text-carvao-800">
              <strong className="block">Cliente conferiu e concordou com a vistoria</strong>
              <span className="text-carvao-600">
                Marque depois de mostrar o laudo ao cliente. Fica registrado no PDF.
              </span>
            </span>
          </label>

          <CampoAssinatura
            name="assinaturaCliente"
            rotulo="Assinatura do cliente"
            valorInicial={vistoriaExistente?.assinaturaCliente}
            dica="Entregue o aparelho ao cliente para assinar. A assinatura sai impressa no laudo em PDF."
          />
        </div>
      </Cartao>

      {preenchidos < totalItens && (
        <Aviso>
          Faltam {totalItens - preenchidos} item(ns) do checklist. É possível salvar assim
          mesmo, mas o laudo fica incompleto.
        </Aviso>
      )}

      {Object.values(checklist).filter((v) => v === "AVARIA").length > 0 &&
        avarias.length === 0 && (
          <Aviso tipo="erro">
            Há itens marcados como avaria no checklist, mas nenhuma avaria detalhada.
            Descreva-as acima para proteger a loja e o cliente.
          </Aviso>
        )}

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <div className="flex items-center justify-between gap-4">
        <Badge cor="bg-carvao-100 text-carvao-700">
          {avarias.length} avaria(s) · {preenchidos}/{totalItens} conferidos
        </Badge>
        <Enviar tipo={tipo} />
      </div>
    </form>
  );
}
