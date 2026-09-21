import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, CabecalhoCartao, Selecao, TituloPagina,
} from "@/componentes/ui";
import { CATEGORIA_SERVICO, NIVEIS_COMBUSTIVEL } from "@/lib/constantes";
import {
  brl, fimDoExpediente, num, paraInputDataHora, placa as formatarPlaca, telefone,
} from "@/lib/format";
import { BuscaSelecao } from "@/componentes/busca-selecao";
import {
  agora, catalogoAtivo, clientesComVeiculos, novoId, porCategoria,
  type ClienteComVeiculos,
} from "@/lib/consultas";
import { useEquipe } from "@/lib/equipe";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Servico } from "@/lib/tipos";

type Linha = {
  chave: string;
  servicoId: string;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  garantiaDias: number;
};

const chaveNova = () => Math.random().toString(36).slice(2, 10);
const linhaVazia = (): Linha => ({
  chave: chaveNova(), servicoId: "", descricao: "",
  quantidade: 1, precoUnit: 0, garantiaDias: 0,
});

export function NovaOrdem() {
  const navegar = useNavigate();
  const { ativos } = useEquipe();

  const [clientes, setClientes] = useState<ClienteComVeiculos[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [cs, sv] = await Promise.all([clientesComVeiculos(), catalogoAtivo()]);
      if (!vivo) return;
      setClientes(cs);
      setServicos(sv);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const cliente = clientes.find((c) => c.id === clienteId);
  const veiculos = cliente?.veiculos ?? [];

  /**
   * As placas entram no texto de busca sem aparecer em destaque: na oficina o
   * atendente costuma ter a placa na mao antes do nome do dono.
   */
  const opcoesCliente = useMemo(
    () => clientes.map((c) => {
      const placas = (c.veiculos ?? []).map((v) => v.placa).join(" ");
      return {
        valor: c.id,
        rotulo: c.nome,
        detalhe: [telefone(c.telefone), placas].filter(Boolean).join(" · "),
        busca: `${c.nome} ${c.telefone} ${placas}`,
      };
    }),
    [clientes],
  );

  const grupos = useMemo(() => porCategoria(servicos), [servicos]);
  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.quantidade * l.precoUnit, 0),
    [linhas],
  );

  const atualizar = (chave: string, m: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...m } : l)));

  function escolherServico(chave: string, servicoId: string) {
    const s = servicos.find((x) => x.id === servicoId);
    atualizar(chave, {
      servicoId,
      descricao: s?.nome ?? "",
      precoUnit: s ? num(s.preco) : 0,
      garantiaDias: s?.garantiaDias ?? 0,
    });
  }

  async function abrir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    const itens = linhas.filter((l) => l.descricao.trim());
    if (itens.length === 0) return setErro("Adicione pelo menos um serviço.");

    const f = new FormData(e.currentTarget);
    const funcionarioEntradaId = String(f.get("funcionarioEntradaId") ?? "");
    if (!clienteId || !veiculoId || !funcionarioEntradaId) {
      return setErro("Cliente, veículo e quem recebeu o veículo são obrigatórios.");
    }

    setSalvando(true);
    const km = Number(String(f.get("kmEntrada") ?? "").replace(/\D/g, "")) || null;
    const previsao = String(f.get("previsaoEntrega") ?? "");
    const subtotal = itens.reduce((s, l) => s + l.quantidade * l.precoUnit, 0);
    const id = novoId();

    const { error } = await sb.from("ordens_servico").insert({
      id,
      clienteId,
      veiculoId,
      funcionarioEntradaId,
      kmEntrada: km,
      combustivelEntrada: String(f.get("combustivelEntrada") ?? "") || null,
      // O proprio campo ja traz a hora; cravar 18:00 aqui fazia toda OS
      // prometer entrega no fim do dia, independentemente do combinado.
      previsaoEntrega: previsao ? new Date(previsao).toISOString() : null,
      observacoesEntrada: String(f.get("observacoesEntrada") ?? "").trim() || null,
      subtotal: subtotal.toFixed(2),
      total: subtotal.toFixed(2),
      atualizadoEm: agora(),
    });

    if (error) { setSalvando(false); return setErro(mensagemErro(error)); }

    const { error: erroItens } = await sb.from("os_itens").insert(
      itens.map((l) => ({
        id: novoId(),
        ordemId: id,
        servicoId: l.servicoId || null,
        descricao: l.descricao,
        quantidade: l.quantidade.toFixed(2),
        precoUnit: l.precoUnit.toFixed(2),
        desconto: "0.00",
        total: (l.quantidade * l.precoUnit).toFixed(2),
        garantiaDias: l.garantiaDias,
      })),
    );

    if (km && km > 0) {
      await sb.from("veiculos").update({ km }).eq("id", veiculoId);
    }

    setSalvando(false);
    if (erroItens) return setErro(mensagemErro(erroItens));
    navegar(`/sistema/ordens/${id}`);
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <>
      <TituloPagina
        titulo="Entrada de veículo"
        descricao="Abre a OS direto, sem orçamento prévio. Para converter um orçamento aprovado, use a tela do orçamento."
      />

      {ativos.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Nenhum funcionário ativo cadastrado. Toda OS precisa de um responsável pela
            entrada — cadastre a equipe no RH.
          </Aviso>
        </div>
      )}

      <form onSubmit={abrir} className="space-y-6">
        <Cartao>
          <CabecalhoCartao titulo="Entrada do veículo"
            descricao="Quem recebeu, em que estado e para quando." />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <BuscaSelecao rotulo="Cliente" required valor={clienteId}
              opcoes={opcoesCliente}
              placeholder="Buscar por nome, telefone ou placa..."
              vazio="Nenhum cliente encontrado."
              aoEscolher={(v) => { setClienteId(v); setVeiculoId(""); }} />

            <BuscaSelecao rotulo="Veículo" required valor={veiculoId} disabled={!cliente}
              opcoes={veiculos.map((v) => ({
                valor: v.id,
                rotulo: `${formatarPlaca(v.placa)} — ${v.marca} ${v.modelo}`,
              }))}
              placeholder={cliente ? "Buscar veículo..." : "Escolha o cliente primeiro"}
              vazio="Este cliente não tem veículo cadastrado."
              aoEscolher={setVeiculoId} />

            <Selecao rotulo="Funcionário que recebeu" name="funcionarioEntradaId"
              dica="Responsável pela entrada" required>
              <option value="">Selecione...</option>
              {ativos.map((f) => (
                <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
              ))}
            </Selecao>

            <Campo rotulo="KM na entrada" name="kmEntrada" type="number" min={0}
              defaultValue={veiculos.find((v) => v.id === veiculoId)?.km ?? ""} />
            <Selecao rotulo="Nível de combustível" name="combustivelEntrada">
              <option value="">Não informado</option>
              {NIVEIS_COMBUSTIVEL.map((n) => <option key={n} value={n}>{n}</option>)}
            </Selecao>
            <Campo rotulo="Previsão de entrega" name="previsaoEntrega"
              type="datetime-local" defaultValue={fimDoExpediente(1)}
              min={paraInputDataHora(new Date())}
              dica="Data e hora combinadas com o cliente" />

            <AreaTexto rotulo="Observações da entrada" name="observacoesEntrada"
              className="sm:col-span-2 lg:col-span-3" rows={2}
              placeholder="Queixa do cliente, avarias relatadas, pertences deixados no veículo..." />
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Serviços a executar"
            acao={
              <Botao type="button" variante="fantasma"
                onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}>
                <Plus className="h-4 w-4" aria-hidden />
                Adicionar
              </Botao>
            } />
          <div className="divide-y divide-carvao-100">
            {linhas.map((l, idx) => (
              <div key={l.chave} className="grid gap-3 p-5 lg:grid-cols-12">
                <Selecao rotulo="Serviço" className="lg:col-span-4" value={l.servicoId}
                  onChange={(e) => escolherServico(l.chave, e.target.value)}>
                  <option value="">— avulso —</option>
                  {grupos.map(([cat, lista]) => (
                    <optgroup key={cat} label={CATEGORIA_SERVICO[cat as keyof typeof CATEGORIA_SERVICO]}>
                      {lista.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.codigo} · {s.nome} ({brl(s.preco)})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Selecao>
                <Campo rotulo="Descrição" className="lg:col-span-4" value={l.descricao}
                  onChange={(e) => atualizar(l.chave, { descricao: e.target.value })} />
                <Campo rotulo="Qtd" type="number" step="0.01" min={0.01} className="lg:col-span-1"
                  value={l.quantidade}
                  onChange={(e) => atualizar(l.chave, { quantidade: Number(e.target.value) || 0 })} />
                <Campo rotulo="Preço un." type="number" step="0.01" min={0} className="lg:col-span-2"
                  value={l.precoUnit}
                  onChange={(e) => atualizar(l.chave, { precoUnit: Number(e.target.value) || 0 })} />
                <div className="flex items-end lg:col-span-1">
                  {linhas.length > 1 && (
                    <button type="button"
                      onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                      className="mb-1 rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                      aria-label={`Remover serviço ${idx + 1}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-4 border-t border-carvao-200 bg-carvao-50 px-5 py-4">
            <span className="text-sm font-semibold uppercase tracking-wide text-carvao-600">
              Total da OS
            </span>
            <span className="font-display text-2xl font-extrabold text-carvao-950">
              {brl(total)}
            </span>
          </div>
        </Cartao>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex justify-end">
          <Botao type="submit" disabled={salvando} className="px-6 py-2.5">
            {salvando ? "Abrindo..." : "Abrir ordem de serviço"}
          </Botao>
        </div>
      </form>
    </>
  );
}
