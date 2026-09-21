"use client";

import { useActionState, useState } from "react";
import type { Papel, Setor, TipoOcorrenciaRH } from "@prisma/client";
import { KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  AreaTexto,
  Aviso,
  Badge,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  LinhaVazia,
  Selecao,
  Tabela,
  Td,
  Th,
} from "@/components/ui";
import { PAPEL, SETOR, TIPO_OCORRENCIA_RH } from "@/lib/constantes";
import { brl, data, paraInputDate, telefone } from "@/lib/format";
import {
  alternarAtivoFuncionarioAction,
  criarAcessoAction,
  excluirOcorrenciaAction,
  revogarAcessoAction,
  salvarFuncionarioAction,
  salvarOcorrenciaAction,
  type Estado,
} from "./actions";

export type FuncionarioItem = {
  id: string;
  matricula: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cargo: string;
  setor: Setor;
  admissao: Date;
  demissao: Date | null;
  salario: number;
  comissaoPct: number;
  ativo: boolean;
  observacoes: string | null;
  usuario: { id: string; email: string; papel: Papel; ativo: boolean } | null;
  _count: { entradas: number; saidas: number; itensExecutados: number };
};

export type OcorrenciaItem = {
  id: string;
  tipo: TipoOcorrenciaRH;
  inicio: Date;
  fim: Date | null;
  descricao: string | null;
  funcionario: { nome: string };
  funcionarioId: string;
};

export type ComissaoItem = {
  id: string;
  valor: number;
  baseCalculo: number;
  percentual: number;
  pago: boolean;
  referencia: string;
  funcionario: { nome: string };
};

export function PainelRH({
  funcionarios,
  ocorrencias,
  comissoes,
  ehAdmin,
}: {
  funcionarios: FuncionarioItem[];
  ocorrencias: OcorrenciaItem[];
  comissoes: ComissaoItem[];
  ehAdmin: boolean;
}) {
  const [aba, setAba] = useState<"equipe" | "ocorrencias" | "comissoes">("equipe");
  const [editando, setEditando] = useState<FuncionarioItem | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [acessoPara, setAcessoPara] = useState<FuncionarioItem | null>(null);

  const [estadoFunc, acaoFunc] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await salvarFuncionarioAction(prev, dados);
      if (r.ok) {
        setFormAberto(false);
        setEditando(null);
      }
      return r;
    },
    {},
  );

  const [estadoOco, acaoOco] = useActionState<Estado, FormData>(
    salvarOcorrenciaAction,
    {},
  );

  const [estadoAcesso, acaoAcesso] = useActionState<Estado, FormData>(
    async (prev, dados) => {
      const r = await criarAcessoAction(prev, dados);
      if (r.ok) setAcessoPara(null);
      return r;
    },
    {},
  );

  const ativos = funcionarios.filter((f) => f.ativo);

  const ABAS = [
    { chave: "equipe" as const, rotulo: `Equipe (${ativos.length})` },
    { chave: "ocorrencias" as const, rotulo: "Ocorrências" },
    { chave: "comissoes" as const, rotulo: "Comissões" },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Seções do RH" className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            aria-current={aba === a.chave ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              aba === a.chave
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      {/* ---------------- EQUIPE ---------------- */}
      {aba === "equipe" && (
        <>
          {formAberto && (
            <Cartao>
              <CabecalhoCartao
                titulo={editando ? `Editar: ${editando.nome}` : "Novo funcionário"}
                acao={
                  <button
                    type="button"
                    onClick={() => {
                      setFormAberto(false);
                      setEditando(null);
                    }}
                    className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                }
              />
              <form
                key={editando?.id ?? "novo"}
                action={acaoFunc}
                className="space-y-4 p-5"
              >
                {editando && <input type="hidden" name="id" value={editando.id} />}
                <div className="grid gap-4 sm:grid-cols-6">
                  <Campo
                    rotulo="Matrícula"
                    name="matricula"
                    defaultValue={editando?.matricula ?? ""}
                    placeholder="F001"
                    required
                  />
                  <Campo
                    rotulo="Nome completo"
                    name="nome"
                    defaultValue={editando?.nome ?? ""}
                    className="sm:col-span-3"
                    required
                  />
                  <Campo
                    rotulo="CPF"
                    name="cpf"
                    defaultValue={editando?.cpf ?? ""}
                    className="sm:col-span-2"
                  />
                  <Campo
                    rotulo="Cargo"
                    name="cargo"
                    defaultValue={editando?.cargo ?? ""}
                    placeholder="Funileiro, esteticista, atendente..."
                    className="sm:col-span-2"
                    required
                  />
                  <Selecao
                    rotulo="Setor"
                    name="setor"
                    defaultValue={editando?.setor ?? "ESTETICA"}
                    className="sm:col-span-2"
                  >
                    {Object.entries(SETOR).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Selecao>
                  <Campo
                    rotulo="Admissão"
                    name="admissao"
                    type="date"
                    defaultValue={
                      editando ? paraInputDate(editando.admissao) : paraInputDate(new Date())
                    }
                    className="sm:col-span-2"
                    required
                  />
                  <Campo
                    rotulo="Telefone"
                    name="telefone"
                    defaultValue={editando?.telefone ?? ""}
                    className="sm:col-span-2"
                  />
                  <Campo
                    rotulo="E-mail"
                    name="email"
                    type="email"
                    defaultValue={editando?.email ?? ""}
                    className="sm:col-span-2"
                  />
                  <Campo
                    rotulo="Salário (R$)"
                    name="salario"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={editando?.salario ?? 0}
                  />
                  <Campo
                    rotulo="Comissão (%)"
                    name="comissaoPct"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    defaultValue={editando?.comissaoPct ?? 0}
                    dica="Padrão quando o serviço não define"
                  />
                  <AreaTexto
                    rotulo="Observações"
                    name="observacoes"
                    rows={2}
                    defaultValue={editando?.observacoes ?? ""}
                    className="sm:col-span-6"
                  />
                </div>
                {estadoFunc.erro && <Aviso tipo="erro">{estadoFunc.erro}</Aviso>}
                <Botao type="submit">
                  {editando ? "Salvar alterações" : "Cadastrar funcionário"}
                </Botao>
              </form>
            </Cartao>
          )}

          {acessoPara && ehAdmin && (
            <Cartao>
              <CabecalhoCartao
                titulo={`Acesso ao sistema: ${acessoPara.nome}`}
                descricao="Define e-mail, senha e nível de permissão."
                acao={
                  <button
                    type="button"
                    onClick={() => setAcessoPara(null)}
                    className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                }
              />
              <form action={acaoAcesso} className="space-y-4 p-5">
                <input type="hidden" name="funcionarioId" value={acessoPara.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo
                    rotulo="E-mail de acesso"
                    name="email"
                    type="email"
                    defaultValue={acessoPara.usuario?.email ?? acessoPara.email ?? ""}
                    required
                  />
                  <Campo
                    rotulo={acessoPara.usuario ? "Nova senha" : "Senha"}
                    name="senha"
                    type="password"
                    minLength={6}
                    dica="Mínimo de 6 caracteres"
                    required
                  />
                  <Selecao
                    rotulo="Permissão"
                    name="papel"
                    defaultValue={acessoPara.usuario?.papel ?? "TECNICO"}
                  >
                    {Object.entries(PAPEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Selecao>
                </div>
                {estadoAcesso.erro && <Aviso tipo="erro">{estadoAcesso.erro}</Aviso>}
                <Botao type="submit">
                  {acessoPara.usuario ? "Atualizar acesso" : "Liberar acesso"}
                </Botao>
              </form>
            </Cartao>
          )}

          <Cartao>
            <CabecalhoCartao
              titulo="Equipe"
              descricao={`${ativos.length} ativo(s) de ${funcionarios.length}`}
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
                    Novo funcionário
                  </Botao>
                )
              }
            />
            <Tabela>
              <thead>
                <tr>
                  <Th>Matrícula</Th>
                  <Th>Funcionário</Th>
                  <Th>Setor</Th>
                  <Th>Admissão</Th>
                  <Th className="text-right">Salário</Th>
                  <Th className="text-center">Comissão</Th>
                  <Th className="text-center">Serviços</Th>
                  <Th>Acesso</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {funcionarios.length === 0 && (
                  <LinhaVazia colunas={9} mensagem="Nenhum funcionário cadastrado." />
                )}
                {funcionarios.map((f) => (
                  <tr key={f.id} className={f.ativo ? "hover:bg-carvao-50" : "opacity-50"}>
                    <Td className="font-mono text-xs font-semibold">{f.matricula}</Td>
                    <Td>
                      <p className="font-medium text-carvao-950">{f.nome}</p>
                      <p className="text-xs text-carvao-500">
                        {f.cargo}
                        {f.telefone && ` · ${telefone(f.telefone)}`}
                      </p>
                    </Td>
                    <Td>
                      <Badge cor="bg-carvao-100 text-carvao-700">{SETOR[f.setor]}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-carvao-600">
                      {data(f.admissao)}
                      {f.demissao && (
                        <span className="block text-xs text-marca-600">
                          saiu {data(f.demissao)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">{brl(f.salario)}</Td>
                    <Td className="text-center text-carvao-600">
                      {f.comissaoPct > 0 ? `${f.comissaoPct}%` : "—"}
                    </Td>
                    <Td className="text-center text-carvao-600">
                      {f._count.itensExecutados}
                      <span className="block text-xs text-carvao-400">
                        {f._count.entradas}e / {f._count.saidas}s
                      </span>
                    </Td>
                    <Td>
                      {f.usuario ? (
                        <div>
                          <Badge
                            cor={
                              f.usuario.ativo
                                ? "bg-emerald-600 text-white"
                                : "bg-carvao-300 text-carvao-700"
                            }
                          >
                            {PAPEL[f.usuario.papel]}
                          </Badge>
                          <p className="mt-0.5 text-xs text-carvao-500">
                            {f.usuario.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-carvao-400">Sem acesso</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(f);
                            setFormAberto(true);
                          }}
                          className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                          aria-label={`Editar ${f.nome}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        {ehAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAcessoPara(f)}
                              className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                              aria-label={`Gerenciar acesso de ${f.nome}`}
                            >
                              <KeyRound className="h-4 w-4" aria-hidden />
                            </button>
                            {f.usuario && (
                              <form action={revogarAcessoAction}>
                                <input type="hidden" name="usuarioId" value={f.usuario.id} />
                                <button
                                  type="submit"
                                  className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100"
                                >
                                  {f.usuario.ativo ? "Bloquear" : "Liberar"}
                                </button>
                              </form>
                            )}
                          </>
                        )}
                        <form action={alternarAtivoFuncionarioAction}>
                          <input type="hidden" name="id" value={f.id} />
                          <button
                            type="submit"
                            className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100 hover:text-carvao-900"
                          >
                            {f.ativo ? "Desligar" : "Readmitir"}
                          </button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </>
      )}

      {/* ---------------- OCORRÊNCIAS ---------------- */}
      {aba === "ocorrencias" && (
        <>
          <Cartao>
            <CabecalhoCartao
              titulo="Registrar ocorrência"
              descricao="Férias, faltas, atestados, advertências e treinamentos"
            />
            <form action={acaoOco} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-5">
                <Selecao
                  rotulo="Funcionário"
                  name="funcionarioId"
                  className="sm:col-span-2"
                  required
                >
                  <option value="">Selecione...</option>
                  {ativos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </Selecao>
                <Selecao rotulo="Tipo" name="tipo" defaultValue="FALTA">
                  {Object.entries(TIPO_OCORRENCIA_RH).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Selecao>
                <Campo
                  rotulo="Início"
                  name="inicio"
                  type="date"
                  defaultValue={paraInputDate(new Date())}
                  required
                />
                <Campo rotulo="Fim (opcional)" name="fim" type="date" />
                <AreaTexto
                  rotulo="Descrição"
                  name="descricao"
                  rows={2}
                  className="sm:col-span-5"
                />
              </div>
              {estadoOco.erro && <Aviso tipo="erro">{estadoOco.erro}</Aviso>}
              {estadoOco.ok && <Aviso tipo="sucesso">{estadoOco.ok}</Aviso>}
              <Botao type="submit">Registrar</Botao>
            </form>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Histórico" descricao="Últimas 50 ocorrências" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Funcionário</Th>
                  <Th>Tipo</Th>
                  <Th>Período</Th>
                  <Th>Descrição</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {ocorrencias.length === 0 && (
                  <LinhaVazia colunas={5} mensagem="Nenhuma ocorrência registrada." />
                )}
                {ocorrencias.map((o) => (
                  <tr key={o.id} className="hover:bg-carvao-50">
                    <Td className="font-medium">{o.funcionario.nome}</Td>
                    <Td>
                      <Badge
                        cor={
                          ["ADVERTENCIA", "SUSPENSAO", "FALTA"].includes(o.tipo)
                            ? "bg-marca-600 text-white"
                            : o.tipo === "ELOGIO"
                              ? "bg-emerald-600 text-white"
                              : "bg-carvao-100 text-carvao-700"
                        }
                      >
                        {TIPO_OCORRENCIA_RH[o.tipo]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-carvao-600">
                      {data(o.inicio)}
                      {o.fim && ` — ${data(o.fim)}`}
                    </Td>
                    <Td className="text-carvao-600">{o.descricao ?? "—"}</Td>
                    <Td className="text-right">
                      <form action={excluirOcorrenciaAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button
                          type="submit"
                          className="rounded p-1.5 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                          aria-label="Excluir ocorrência"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </>
      )}

      {/* ---------------- COMISSÕES ---------------- */}
      {aba === "comissoes" && (
        <Cartao>
          <CabecalhoCartao
            titulo="Comissões"
            descricao="Calculadas na entrega da OS, a partir do responsável de cada serviço"
          />
          <Tabela>
            <thead>
              <tr>
                <Th>Referência</Th>
                <Th>Funcionário</Th>
                <Th className="text-right">Base</Th>
                <Th className="text-center">%</Th>
                <Th className="text-right">Comissão</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {comissoes.length === 0 && (
                <LinhaVazia
                  colunas={6}
                  mensagem="Nenhuma comissão gerada. Elas aparecem quando uma OS é entregue."
                />
              )}
              {comissoes.map((c) => (
                <tr key={c.id} className="hover:bg-carvao-50">
                  <Td className="font-mono text-xs">{c.referencia}</Td>
                  <Td className="font-medium">{c.funcionario.nome}</Td>
                  <Td className="text-right text-carvao-600">{brl(c.baseCalculo)}</Td>
                  <Td className="text-center text-carvao-600">{c.percentual}%</Td>
                  <Td className="text-right font-bold text-carvao-950">{brl(c.valor)}</Td>
                  <Td>
                    <Badge
                      cor={
                        c.pago
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-600 text-white"
                      }
                    >
                      {c.pago ? "Paga" : "A pagar"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Cartao>
      )}
    </div>
  );
}
