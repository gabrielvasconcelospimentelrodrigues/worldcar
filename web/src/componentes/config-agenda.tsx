import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  Aviso, Botao, CabecalhoCartao, Campo, Cartao, LinhaVazia, Tabela, Td, Th,
} from "@/componentes/ui";
import { SETOR } from "@/lib/constantes";
import { data as fmtData } from "@/lib/format";
import { novoId } from "@/lib/consultas";
import { mensagemErro, sb } from "@/lib/supabase";

/**
 * Configuracao da agenda: funcionamento, capacidade e fechamentos.
 *
 * Nada disso fica no codigo porque nada disso e estavel. Oficina muda horario
 * no verao, fecha em feriado municipal que nenhum calendario embutido conhece,
 * contrata mais um lavador. Se cada mudanca dessas exigisse programador, a
 * agenda ficaria errada na primeira semana e ninguem confiaria nela.
 */

type Horario = {
  diaSemana: number;
  aberto: boolean;
  abre: string;
  fecha: string;
  pausaInicio: string | null;
  pausaFim: string | null;
};

type Capacidade = { setor: string; simultaneos: number; aceitaSite: boolean };

type Bloqueio = { id: string; inicio: string; fim: string; motivo: string };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "08:00:00" do banco vira "08:00" para o <input type="time">. */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

export function ConfigAgenda() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [capacidades, setCapacidades] = useState<Capacidade[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [h, c, b] = await Promise.all([
      sb.from("horarios_funcionamento").select("*").order("diaSemana"),
      sb.from("capacidade_setor").select("*").order("setor"),
      sb.from("bloqueios_agenda").select("*").gte("fim", new Date().toISOString())
        .order("inicio").limit(30),
    ]);
    const falhou = h.error ?? c.error ?? b.error;
    setErro(falhou ? mensagemErro(falhou) : null);
    setHorarios((h.data as Horario[]) ?? []);
    setCapacidades((c.data as Capacidade[]) ?? []);
    setBloqueios((b.data as Bloqueio[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvarHorarios() {
    setSalvando(true); setErro(null); setOk(null);
    // Uma chamada por dia em vez de `upsert` em lote: são sete linhas, e o erro
    // de um dia não pode derrubar a gravação dos outros seis.
    for (const h of horarios) {
      const { error } = await sb.from("horarios_funcionamento").update({
        aberto: h.aberto,
        abre: h.abre,
        fecha: h.fecha,
        pausaInicio: h.pausaInicio || null,
        pausaFim: h.pausaFim || null,
      }).eq("diaSemana", h.diaSemana);
      if (error) { setSalvando(false); return setErro(mensagemErro(error)); }
    }
    setSalvando(false);
    setOk("Horários de funcionamento atualizados.");
  }

  async function salvarCapacidades() {
    setSalvando(true); setErro(null); setOk(null);
    for (const c of capacidades) {
      const { error } = await sb.from("capacidade_setor").update({
        simultaneos: c.simultaneos,
        aceitaSite: c.aceitaSite,
      }).eq("setor", c.setor);
      if (error) { setSalvando(false); return setErro(mensagemErro(error)); }
    }
    setSalvando(false);
    setOk("Capacidade atualizada.");
  }

  async function criarBloqueio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const de = String(f.get("de") ?? "");
    const ate = String(f.get("ate") ?? "");
    const motivo = String(f.get("motivo") ?? "").trim();
    if (!de || !ate || !motivo) return setErro("Preencha as datas e o motivo.");

    setSalvando(true); setErro(null); setOk(null);
    const { error } = await sb.from("bloqueios_agenda").insert({
      id: novoId(),
      // O fim é exclusivo no banco: somar um dia faz o bloqueio cobrir a data
      // final inteira, que é o que a pessoa quer dizer ao escolher "até".
      inicio: new Date(`${de}T00:00:00`).toISOString(),
      fim: new Date(new Date(`${ate}T00:00:00`).getTime() + 86_400_000).toISOString(),
      motivo,
    });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    e.currentTarget.reset();
    setOk("Fechamento registrado. Esses dias somem da agenda do site.");
    await carregar();
  }

  async function removerBloqueio(id: string) {
    const { error } = await sb.from("bloqueios_agenda").delete().eq("id", id);
    if (error) return setErro(mensagemErro(error));
    await carregar();
  }

  const trocar = (dia: number, campo: keyof Horario, valor: unknown) =>
    setHorarios((hs) => hs.map((h) => (h.diaSemana === dia ? { ...h, [campo]: valor } : h)));

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}

      {/* -------------------------------------------- funcionamento */}
      <Cartao>
        <CabecalhoCartao titulo="Horário de funcionamento"
          descricao="O site só oferece horários dentro desta faixa."
          acao={
            <Botao type="button" disabled={salvando} onClick={() => void salvarHorarios()}>
              <Save className="h-4 w-4" aria-hidden />
              Salvar
            </Botao>
          } />
        <Tabela>
          <thead>
            <tr>
              <Th>Dia</Th>
              <Th className="text-center">Abre?</Th>
              <Th>Das</Th>
              <Th>Até</Th>
              <Th>Intervalo</Th>
            </tr>
          </thead>
          <tbody>
            {horarios.map((h) => (
              <tr key={h.diaSemana} className={h.aberto ? "" : "bg-carvao-50"}>
                <Td className="font-medium text-carvao-950">{DIAS[h.diaSemana]}</Td>
                <Td className="text-center">
                  <input type="checkbox" checked={h.aberto}
                    aria-label={`${DIAS[h.diaSemana]}: abre?`}
                    onChange={(e) => trocar(h.diaSemana, "aberto", e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-marca-500)]" />
                </Td>
                <Td>
                  <input type="time" value={hhmm(h.abre)} disabled={!h.aberto}
                    aria-label={`${DIAS[h.diaSemana]}: abre às`}
                    onChange={(e) => trocar(h.diaSemana, "abre", e.target.value)}
                    className="rounded border border-carvao-300 px-2 py-1 text-sm disabled:bg-carvao-100" />
                </Td>
                <Td>
                  <input type="time" value={hhmm(h.fecha)} disabled={!h.aberto}
                    aria-label={`${DIAS[h.diaSemana]}: fecha às`}
                    onChange={(e) => trocar(h.diaSemana, "fecha", e.target.value)}
                    className="rounded border border-carvao-300 px-2 py-1 text-sm disabled:bg-carvao-100" />
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <input type="time" value={hhmm(h.pausaInicio)} disabled={!h.aberto}
                      aria-label={`${DIAS[h.diaSemana]}: intervalo começa`}
                      onChange={(e) => trocar(h.diaSemana, "pausaInicio", e.target.value)}
                      className="rounded border border-carvao-300 px-2 py-1 text-sm disabled:bg-carvao-100" />
                    <span className="text-carvao-400">–</span>
                    <input type="time" value={hhmm(h.pausaFim)} disabled={!h.aberto}
                      aria-label={`${DIAS[h.diaSemana]}: intervalo termina`}
                      onChange={(e) => trocar(h.diaSemana, "pausaFim", e.target.value)}
                      className="rounded border border-carvao-300 px-2 py-1 text-sm disabled:bg-carvao-100" />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>

      {/* -------------------------------------------- capacidade */}
      <Cartao>
        <CabecalhoCartao titulo="Quantos carros ao mesmo tempo"
          descricao="Por setor, porque é a equipe que limita — não o relógio."
          acao={
            <Botao type="button" disabled={salvando} onClick={() => void salvarCapacidades()}>
              <Save className="h-4 w-4" aria-hidden />
              Salvar
            </Botao>
          } />
        <Tabela>
          <thead>
            <tr>
              <Th>Setor</Th>
              <Th className="text-center">Simultâneos</Th>
              <Th className="text-center">Aceita pelo site</Th>
            </tr>
          </thead>
          <tbody>
            {capacidades.map((c) => (
              <tr key={c.setor}>
                <Td className="font-medium text-carvao-950">
                  {SETOR[c.setor as keyof typeof SETOR] ?? c.setor}
                </Td>
                <Td className="text-center">
                  <input type="number" min={0} max={20} value={c.simultaneos}
                    aria-label={`${c.setor}: carros simultâneos`}
                    onChange={(e) => setCapacidades((cs) => cs.map((x) =>
                      x.setor === c.setor
                        ? { ...x, simultaneos: Number(e.target.value) || 0 } : x))}
                    className="w-20 rounded border border-carvao-300 px-2 py-1 text-center text-sm" />
                </Td>
                <Td className="text-center">
                  <input type="checkbox" checked={c.aceitaSite}
                    aria-label={`${c.setor}: aceita agendamento pelo site`}
                    onChange={(e) => setCapacidades((cs) => cs.map((x) =>
                      x.setor === c.setor ? { ...x, aceitaSite: e.target.checked } : x))}
                    className="h-4 w-4 accent-[var(--color-marca-500)]" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="border-t border-carvao-200 px-5 py-3 text-xs text-carvao-500">
          Funilaria e pintura vêm desmarcadas porque dependem de ver o carro para dar
          prazo — um horário chutado trava a oficina. Marque se quiser aceitar mesmo assim.
        </p>
      </Cartao>

      {/* -------------------------------------------- fechamentos */}
      <Cartao>
        <CabecalhoCartao titulo="Feriados e fechamentos"
          descricao="Esses dias somem da agenda do site." />
        <form onSubmit={criarBloqueio}
          className="flex flex-wrap items-end gap-3 border-b border-carvao-200 bg-carvao-50 p-5">
          <Campo rotulo="De" name="de" type="date" required className="w-40" />
          <Campo rotulo="Até" name="ate" type="date" required className="w-40" />
          <Campo rotulo="Motivo" name="motivo" required className="min-w-56 flex-1"
            placeholder="Feriado, férias coletivas, manutenção..." />
          <div className="pb-0.5">
            <Botao type="submit" disabled={salvando}>
              <Plus className="h-4 w-4" aria-hidden />
              Bloquear
            </Botao>
          </div>
        </form>
        <Tabela>
          <thead>
            <tr>
              <Th>Período</Th>
              <Th>Motivo</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {bloqueios.length === 0 && (
              <LinhaVazia colunas={3} mensagem="Nenhum fechamento programado." />
            )}
            {bloqueios.map((b) => (
              <tr key={b.id} className="hover:bg-carvao-50">
                <Td className="whitespace-nowrap text-carvao-800">
                  {fmtData(b.inicio)}
                  {/* O fim é exclusivo: subtrai um dia para exibir o último dia
                      efetivamente fechado, que é como a pessoa cadastrou. */}
                  {" – "}
                  {fmtData(new Date(new Date(b.fim).getTime() - 86_400_000))}
                </Td>
                <Td className="text-carvao-700">{b.motivo}</Td>
                <Td className="text-right">
                  <button type="button" onClick={() => void removerBloqueio(b.id)}
                    className="rounded p-2 text-carvao-400 hover:bg-marca-50 hover:text-marca-600"
                    aria-label={`Remover bloqueio de ${b.motivo}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>
    </div>
  );
}
