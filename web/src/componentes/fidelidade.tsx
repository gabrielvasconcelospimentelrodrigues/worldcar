import { useCallback, useEffect, useState } from "react";
import { Gift, Star } from "lucide-react";
import {
  Aviso, Badge, Botao, CabecalhoCartao, Campo, Cartao, LinhaVazia, Tabela, Td, Th,
} from "@/componentes/ui";
import { brl, data } from "@/lib/format";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Fidelidade do cliente.
 *
 * O ponto entra quando o dinheiro entra, nao quando o carro sai — quem levou o
 * veiculo sem pagar nao acumula. E o saldo e a soma do extrato, nunca um numero
 * guardado a parte: assim sempre da para mostrar ao cliente de onde ele veio.
 */

type Saldo = {
  clienteId: string; pontos: number; gasto12m: number; visitas12m: number;
  nivel: "BRONZE" | "PRATA" | "OURO" | "DIAMANTE";
};

type Movimento = {
  id: string; tipo: string; pontos: number; valorBase: string | null;
  descricao: string | null; criadoEm: string; expiraEm: string | null;
};

const NIVEIS: Record<Saldo["nivel"], { cor: string; proximo: number | null; rotulo: string }> = {
  BRONZE:   { cor: "bg-orange-100 text-orange-800", proximo: 1500,  rotulo: "Bronze" },
  PRATA:    { cor: "bg-carvao-200 text-carvao-700", proximo: 5000,  rotulo: "Prata" },
  OURO:     { cor: "bg-amber-100 text-amber-800",   proximo: 15000, rotulo: "Ouro" },
  DIAMANTE: { cor: "bg-sky-100 text-sky-800",       proximo: null,  rotulo: "Diamante" },
};

export function Fidelidade({ clienteId }: { clienteId: string }) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [extrato, setExtrato] = useState<Movimento[]>([]);
  const [params, setParams] = useState<{ valorDoPonto: string; minimoResgate: number } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [pontos, setPontos] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [s, m, p] = await Promise.all([
      sb.from("fidelidade_saldo").select("*").eq("clienteId", clienteId).maybeSingle(),
      sb.from("fidelidade_movimentos").select("*").eq("clienteId", clienteId)
        .order("criadoEm", { ascending: false }).limit(20),
      sb.from("parametros_fidelidade").select("valorDoPonto, minimoResgate")
        .eq("id", "default").maybeSingle(),
    ]);
    setSaldo((s.data as Saldo) ?? null);
    setExtrato((m.data as Movimento[]) ?? []);
    setParams((p.data as { valorDoPonto: string; minimoResgate: number }) ?? null);
  }, [clienteId]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function resgatar() {
    const n = Number(pontos.replace(/\D/g, ""));
    if (!n) return setErro("Informe quantos pontos resgatar.");
    setOcupado(true); setErro(null); setOk(null);
    const { data: r, error } = await sb.rpc("resgatar_pontos", {
      p_cliente_id: clienteId, p_pontos: n,
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const res = r as { pontos: number; valor: number };
    setOk(`${res.pontos} pontos resgatados — R$ ${Number(res.valor).toFixed(2).replace(".", ",")} de desconto. Aplique no orçamento ou na OS.`);
    setAberto(false);
    setPontos("");
    await carregar();
  }

  if (!saldo) return null;

  const nivel = NIVEIS[saldo.nivel];
  const gasto = Number(saldo.gasto12m);
  const falta = nivel.proximo ? Math.max(0, nivel.proximo - gasto) : 0;
  const valorPonto = Number(params?.valorDoPonto ?? 0.05);
  const vale = Number(saldo.pontos) * valorPonto;
  const minimo = params?.minimoResgate ?? 200;

  return (
    <Cartao className="mt-6">
      <CabecalhoCartao
        titulo="Fidelidade"
        descricao={`${saldo.visitas12m} visita(s) e ${brl(gasto)} nos últimos 12 meses.`}
        acao={
          !aberto && Number(saldo.pontos) >= minimo && (
            <Botao type="button" variante="fantasma" onClick={() => setAberto(true)}>
              <Gift className="h-4 w-4" aria-hidden />
              Resgatar
            </Botao>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-6 border-b border-carvao-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Pontos
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-carvao-950">
            <Star className="h-5 w-5 text-amber-500" aria-hidden />
            {Number(saldo.pontos).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-carvao-500">valem {brl(vale)} em desconto</p>
        </div>

        <div className="min-w-48 flex-1">
          <div className="flex items-center justify-between">
            <Badge cor={nivel.cor}>{nivel.rotulo}</Badge>
            {nivel.proximo && (
              <span className="text-xs text-carvao-500">
                faltam {brl(falta)} para o próximo nível
              </span>
            )}
          </div>
          {nivel.proximo && (
            <span className="mt-2 block h-2 w-full rounded-full bg-carvao-100">
              <span className="block h-2 rounded-full bg-marca-500"
                style={{ width: `${Math.min(100, (gasto / nivel.proximo) * 100)}%` }} />
            </span>
          )}
        </div>
      </div>

      {erro && <div className="px-5 pt-4"><Aviso tipo="erro">{erro}</Aviso></div>}
      {ok && <div className="px-5 pt-4"><Aviso tipo="sucesso">{ok}</Aviso></div>}

      {aberto && (
        <div className="flex flex-wrap items-end gap-3 border-b border-carvao-200 bg-carvao-50 p-5">
          <Campo rotulo="Pontos a resgatar" value={pontos} className="w-40"
            inputMode="numeric" placeholder={String(minimo)}
            onChange={(e) => setPontos(e.target.value.replace(/\D/g, ""))}
            dica={`Mínimo ${minimo} · saldo ${saldo.pontos}`} />
          <div className="pb-0.5 text-sm text-carvao-600">
            = {brl(Number(pontos || 0) * valorPonto)}
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Botao type="button" disabled={ocupado} onClick={() => void resgatar()}>
              Confirmar resgate
            </Botao>
            <button type="button" onClick={() => { setAberto(false); setErro(null); }}
              className="px-2 text-sm font-semibold text-carvao-500 hover:text-carvao-900">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Tabela>
        <thead>
          <tr>
            <Th>Movimento</Th>
            <Th>Data</Th>
            <Th className="text-right">Pontos</Th>
          </tr>
        </thead>
        <tbody>
          {extrato.length === 0 && (
            <LinhaVazia colunas={3}
              mensagem="Sem movimentação. Os pontos entram quando o pagamento é recebido." />
          )}
          {extrato.map((m) => (
            <tr key={m.id} className="hover:bg-carvao-50">
              <Td>
                <p className="text-carvao-800">{m.descricao ?? m.tipo}</p>
                {m.expiraEm && m.pontos > 0 && (
                  <p className="text-xs text-carvao-500">expira em {data(m.expiraEm)}</p>
                )}
              </Td>
              <Td className="whitespace-nowrap text-carvao-600">{data(m.criadoEm)}</Td>
              <Td className={`text-right font-semibold tabular-nums ${
                m.pontos > 0 ? "text-emerald-700" : "text-marca-600"}`}>
                {m.pontos > 0 ? "+" : ""}{m.pontos}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </Cartao>
  );
}
