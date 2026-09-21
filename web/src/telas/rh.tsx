import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  AreaTexto, Aviso, Badge, Botao, CabecalhoCartao, Campo, CampoMascara,
  Cartao, Indicador, LinhaVazia, Selecao, Tabela, Td, Th, TituloPagina,
} from "@/componentes/ui";
import { SETOR, TIPO_OCORRENCIA_RH } from "@/lib/constantes";
import { brl, data, num, paraInputDate, referenciaMes, telefone } from "@/lib/format";
import { agora, novoId } from "@/lib/consultas";
import { limparCacheEquipe } from "@/lib/equipe";
import { FolhaPagamento } from "@/componentes/folha-pagamento";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Comissao, Funcionario, OcorrenciaRH } from "@/lib/tipos";
import { dinheiroParaNumero, mascararDinheiro, mascararDocumento, mascararTelefone, soDigitos } from "@/lib/mascaras";

type Aba = "equipe" | "folha" | "ocorrencias" | "comissoes";

export function RH() {
  const [aba, setAba] = useState<Aba>("equipe");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ocorrencias, setOcorrencias] = useState<(OcorrenciaRH & {
    funcionarios: { nome: string } | null;
  })[]>([]);
  const [comissoes, setComissoes] = useState<(Comissao & {
    funcionarios: { nome: string } | null;
  })[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const carregar = useCallback(async () => {
    const [f, o, c] = await Promise.all([
      sb.from("funcionarios").select("*")
        .order("ativo", { ascending: false }).order("nome"),
      sb.from("ocorrencias_rh").select("*, funcionarios(nome)")
        .order("inicio", { ascending: false }).limit(50),
      sb.from("comissoes").select("*, funcionarios(nome)")
        .order("referencia", { ascending: false }).limit(100),
    ]);
    setErro(f.error ? mensagemErro(f.error) : null);
    setFuncionarios((f.data as Funcionario[]) ?? []);
    setOcorrencias((o.data as never) ?? []);
    setComissoes((c.data as never) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvarFuncionario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    setOk(null);

    const f = new FormData(e.currentTarget);
    const vazio = (k: string) => String(f.get(k) ?? "").trim() || null;
    const registro = {
      matricula: String(f.get("matricula") ?? "").trim().toUpperCase(),
      nome: String(f.get("nome") ?? "").trim(),
      cpf: vazio("cpf")?.replace(/\D/g, "") ?? null,
      telefone: vazio("telefone"),
      email: vazio("email"),
      cargo: String(f.get("cargo") ?? "").trim(),
      setor: String(f.get("setor") ?? "ADMINISTRATIVO"),
      admissao: new Date(`${String(f.get("admissao"))}T12:00:00`).toISOString(),
      salario: (Number(f.get("salario")) || 0).toFixed(2),
      comissaoPct: (Number(f.get("comissaoPct")) || 0).toFixed(2),
      observacoes: vazio("observacoes"),
      atualizadoEm: agora(),
    };

    const { error } = editando
      ? await sb.from("funcionarios").update(registro).eq("id", editando.id)
      : await sb.from("funcionarios").insert({ ...registro, id: novoId(), criadoEm: agora() });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setFormAberto(false);
    setEditando(null);
    setOk(editando ? "Funcionário atualizado." : "Funcionário cadastrado.");
    limparCacheEquipe();
    await carregar();
  }

  async function alternarAtivo(f: Funcionario) {
    setOcupado(true);
    await sb.from("funcionarios").update({
      ativo: !f.ativo,
      demissao: f.ativo ? agora() : null,
      atualizadoEm: agora(),
    }).eq("id", f.id);
    setOcupado(false);
    limparCacheEquipe();
    await carregar();
  }

  async function salvarOcorrencia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const f = new FormData(e.currentTarget);
    const inicio = String(f.get("inicio") ?? "");
    const fim = String(f.get("fim") ?? "");
    if (fim && fim < inicio) {
      setOcupado(false);
      return setErro("A data final não pode ser anterior à inicial.");
    }

    const { error } = await sb.from("ocorrencias_rh").insert({
      id: novoId(),
      funcionarioId: String(f.get("funcionarioId") ?? ""),
      tipo: String(f.get("tipo") ?? "OUTRO"),
      inicio: new Date(`${inicio}T12:00:00`).toISOString(),
      fim: fim ? new Date(`${fim}T12:00:00`).toISOString() : null,
      descricao: String(f.get("descricao") ?? "").trim() || null,
      criadoEm: agora(),
    });

    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setOk("Ocorrência registrada.");
    await carregar();
  }

  async function excluirOcorrencia(id: string) {
    setOcupado(true);
    await sb.from("ocorrencias_rh").delete().eq("id", id);
    setOcupado(false);
    await carregar();
  }

  const ativos = funcionarios.filter((f) => f.ativo);
  const folha = ativos.reduce((s, f) => s + num(f.salario), 0);
  const ref = referenciaMes();
  const comissoesMes = comissoes.filter((c) => c.referencia === ref)
    .reduce((s, c) => s + num(c.valor), 0);
  const aPagar = comissoes.filter((c) => !c.pago).reduce((s, c) => s + num(c.valor), 0);

  const ABAS: { chave: Aba; rotulo: string }[] = [
    { chave: "equipe", rotulo: `Equipe (${ativos.length})` },
    { chave: "folha", rotulo: "Folha de pagamento" },
    { chave: "ocorrencias", rotulo: "Ocorrências" },
    { chave: "comissoes", rotulo: "Comissões" },
  ];

  return (
    <>
      <TituloPagina titulo="Recursos humanos"
        descricao="Equipe, folha de pagamento, ocorrências e comissões." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Funcionários ativos" valor={String(ativos.length)} />
        <Indicador rotulo="Salários base" valor={brl(folha)}
          detalhe="Sem comissões e encargos" />
        <Indicador rotulo="Comissões do mês" valor={brl(comissoesMes)}
          detalhe={`Referência ${ref}`} />
        <Indicador rotulo="Comissões a pagar" valor={brl(aPagar)} destaque={aPagar > 0} />
      </div>

      {erro && <div className="mb-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      <nav aria-label="Seções do RH" className="mb-6 flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button key={a.chave} type="button" onClick={() => setAba(a.chave)}
            aria-current={aba === a.chave ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              aba === a.chave
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"}`}>
            {a.rotulo}
          </button>
        ))}
      </nav>

      {aba === "folha" && <FolhaPagamento />}

      {aba === "equipe" && (
        <div className="space-y-6">
          {formAberto && (
            <Cartao>
              <CabecalhoCartao
                titulo={editando ? `Editar: ${editando.nome}` : "Novo funcionário"}
                acao={
                  <button type="button"
                    onClick={() => { setFormAberto(false); setEditando(null); }}
                    className="rounded p-1 text-carvao-500 hover:text-carvao-900"
                    aria-label="Fechar">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                } />
              <form key={editando?.id ?? "novo"} onSubmit={salvarFuncionario}
                className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-6">
                  <Campo rotulo="Matrícula" name="matricula" required
                    defaultValue={editando?.matricula ?? ""} placeholder="F001" />
                  <Campo rotulo="Nome completo" name="nome" required className="sm:col-span-3"
                    defaultValue={editando?.nome ?? ""} />
                  <CampoMascara rotulo="CPF" name="cpf" className="sm:col-span-2"
                mascara={mascararDocumento} limpar={soDigitos} inputMode="numeric"
                    defaultValue={editando?.cpf ?? ""} />
                  <Campo rotulo="Cargo" name="cargo" required className="sm:col-span-2"
                    defaultValue={editando?.cargo ?? ""}
                    placeholder="Funileiro, esteticista, atendente..." />
                  <Selecao rotulo="Setor" name="setor" className="sm:col-span-2"
                    defaultValue={editando?.setor ?? "ESTETICA"}>
                    {Object.entries(SETOR).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Selecao>
                  <Campo rotulo="Admissão" name="admissao" type="date" required
                    className="sm:col-span-2"
                    defaultValue={paraInputDate(editando?.admissao ?? new Date())} />
                  <CampoMascara rotulo="Telefone" name="telefone" className="sm:col-span-2"
                mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                    defaultValue={editando?.telefone ?? ""} />
                  <Campo rotulo="E-mail" name="email" type="email" className="sm:col-span-2"
                    defaultValue={editando?.email ?? ""} />
                  <CampoMascara rotulo="Salário (R$)" name="salario"
                mascara={mascararDinheiro} limpar={(v) => String(dinheiroParaNumero(v))}
                inputMode="decimal"
                    defaultValue={editando ? num(editando.salario) : 0} />
                  <Campo rotulo="Comissão (%)" name="comissaoPct" type="number" step="0.01"
                    min={0} max={100} defaultValue={editando ? num(editando.comissaoPct) : 0}
                    dica="Padrão quando o serviço não define" />
                  <AreaTexto rotulo="Observações" name="observacoes" rows={2}
                    className="sm:col-span-6" defaultValue={editando?.observacoes ?? ""} />
                </div>
                <Botao type="submit" disabled={ocupado}>
                  {editando ? "Salvar alterações" : "Cadastrar funcionário"}
                </Botao>
              </form>
            </Cartao>
          )}

          <Cartao>
            <CabecalhoCartao titulo="Equipe"
              descricao={`${ativos.length} ativo(s) de ${funcionarios.length}`}
              acao={
                !formAberto && (
                  <Botao type="button"
                    onClick={() => { setEditando(null); setFormAberto(true); }}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Novo funcionário
                  </Botao>
                )
              } />
            <Tabela>
              <thead>
                <tr>
                  <Th>Matrícula</Th>
                  <Th>Funcionário</Th>
                  <Th>Setor</Th>
                  <Th>Admissão</Th>
                  <Th className="text-right">Salário</Th>
                  <Th className="text-center">Comissão</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {carregando && <LinhaVazia colunas={7} mensagem="Carregando..." />}
                {!carregando && funcionarios.length === 0 && (
                  <LinhaVazia colunas={7} mensagem="Nenhum funcionário cadastrado." />
                )}
                {funcionarios.map((f) => (
                  <tr key={f.id} className={f.ativo ? "hover:bg-carvao-50" : "opacity-50"}>
                    <Td className="font-mono text-xs font-semibold">{f.matricula}</Td>
                    <Td>
                      <p className="font-medium text-carvao-950">{f.nome}</p>
                      <p className="text-xs text-carvao-500">
                        {f.cargo}{f.telefone && ` · ${telefone(f.telefone)}`}
                      </p>
                    </Td>
                    <Td><Badge cor="bg-carvao-100 text-carvao-700">{SETOR[f.setor]}</Badge></Td>
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
                      {num(f.comissaoPct) > 0 ? `${num(f.comissaoPct)}%` : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button"
                          onClick={() => { setEditando(f); setFormAberto(true); }}
                          className="rounded p-1.5 text-carvao-500 hover:bg-carvao-100 hover:text-marca-600"
                          aria-label={`Editar ${f.nome}`}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => void alternarAtivo(f)}
                          disabled={ocupado}
                          className="rounded px-2 py-1 text-xs font-semibold text-carvao-500 hover:bg-carvao-100 hover:text-carvao-900">
                          {f.ativo ? "Desligar" : "Readmitir"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </div>
      )}

      {aba === "ocorrencias" && (
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Registrar ocorrência"
              descricao="Férias, faltas, atestados, advertências e treinamentos" />
            <form onSubmit={salvarOcorrencia} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-5">
                <Selecao rotulo="Funcionário" name="funcionarioId" required className="sm:col-span-2">
                  <option value="">Selecione...</option>
                  {ativos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Selecao>
                <Selecao rotulo="Tipo" name="tipo" defaultValue="FALTA">
                  {Object.entries(TIPO_OCORRENCIA_RH).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Selecao>
                <Campo rotulo="Início" name="inicio" type="date" required
                  defaultValue={paraInputDate(new Date())} />
                <Campo rotulo="Fim (opcional)" name="fim" type="date" />
                <AreaTexto rotulo="Descrição" name="descricao" rows={2} className="sm:col-span-5" />
              </div>
              <Botao type="submit" disabled={ocupado}>Registrar</Botao>
            </form>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Histórico" descricao="Últimas 50 ocorrências" />
            <Tabela>
              <thead>
                <tr>
                  <Th>Funcionário</Th><Th>Tipo</Th><Th>Período</Th><Th>Descrição</Th><Th />
                </tr>
              </thead>
              <tbody>
                {ocorrencias.length === 0 && (
                  <LinhaVazia colunas={5} mensagem="Nenhuma ocorrência registrada." />
                )}
                {ocorrencias.map((o) => (
                  <tr key={o.id} className="hover:bg-carvao-50">
                    <Td className="font-medium">{o.funcionarios?.nome ?? "—"}</Td>
                    <Td>
                      <Badge cor={
                        ["ADVERTENCIA", "SUSPENSAO", "FALTA"].includes(o.tipo)
                          ? "bg-marca-600 text-white"
                          : o.tipo === "ELOGIO"
                            ? "bg-emerald-600 text-white"
                            : "bg-carvao-100 text-carvao-700"}>
                        {TIPO_OCORRENCIA_RH[o.tipo]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-carvao-600">
                      {data(o.inicio)}{o.fim && ` — ${data(o.fim)}`}
                    </Td>
                    <Td className="text-carvao-600">{o.descricao ?? "—"}</Td>
                    <Td className="text-right">
                      <button type="button" onClick={() => void excluirOcorrencia(o.id)}
                        disabled={ocupado}
                        className="rounded p-1.5 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                        aria-label="Excluir ocorrência">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Cartao>
        </div>
      )}

      {aba === "comissoes" && (
        <Cartao>
          <CabecalhoCartao titulo="Comissões"
            descricao="Calculadas na entrega da OS, a partir do responsável de cada serviço" />
          <Tabela>
            <thead>
              <tr>
                <Th>Referência</Th><Th>Funcionário</Th>
                <Th className="text-right">Base</Th><Th className="text-center">%</Th>
                <Th className="text-right">Comissão</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {comissoes.length === 0 && (
                <LinhaVazia colunas={6}
                  mensagem="Nenhuma comissão gerada. Elas aparecem quando uma OS é entregue." />
              )}
              {comissoes.map((c) => (
                <tr key={c.id} className="hover:bg-carvao-50">
                  <Td className="font-mono text-xs">{c.referencia}</Td>
                  <Td className="font-medium">{c.funcionarios?.nome ?? "—"}</Td>
                  <Td className="text-right text-carvao-600">{brl(c.baseCalculo)}</Td>
                  <Td className="text-center text-carvao-600">{num(c.percentual)}%</Td>
                  <Td className="text-right font-bold text-carvao-950">{brl(c.valor)}</Td>
                  <Td>
                    <Badge cor={c.pago
                      ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                      {c.pago ? "Paga" : "A pagar"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Cartao>
      )}
    </>
  );
}
