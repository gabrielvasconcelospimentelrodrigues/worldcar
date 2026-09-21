/** O PostgREST devolve numeric como string; number entra igual. */
type Numerico = number | string | { toString(): string } | null | undefined;

/** Decimal do Prisma, string ou number -> number seguro. */
export function num(v: Numerico): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function brl(v: Numerico): string {
  return num(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function data(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function dataHora(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor para <input type="date"> sem escorregar de fuso. */
export function paraInputDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Para <input type="datetime-local">: "2026-09-18T14:30".
 *
 * Monta a partir dos campos locais, nao de toISOString(): aquele converte para
 * UTC e, no fuso do Brasil, jogaria "18:00 de hoje" para "21:00" — ou para o
 * dia seguinte.
 */
export function paraInputDataHora(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}` +
    `T${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
}

/** Hoje as 18h, sugestao inicial de previsao de entrega. */
export function fimDoExpediente(dias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(18, 0, 0, 0);
  return paraInputDataHora(d);
}

/** "abc1d23" -> "ABC1D23"; aceita Mercosul e padrao antigo. */
export function placa(v: string): string {
  const limpo = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return limpo.length === 7 ? `${limpo.slice(0, 3)}-${limpo.slice(3)}` : limpo;
}

export function telefone(v: string | null | undefined): string {
  if (!v) return "-";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

export function documento(v: string | null | undefined): string {
  if (!v) return "-";
  const d = v.replace(/\D/g, "");
  if (d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

/** Numero sequencial formatado: 7 -> "0007" */
export function numeroDoc(n: number): string {
  return String(n).padStart(4, "0");
}

/** Link direto de WhatsApp com mensagem. */
export function linkWhatsapp(tel: string, mensagem?: string): string {
  const d = tel.replace(/\D/g, "");
  const full = d.startsWith("55") ? d : `55${d}`;
  const base = `https://wa.me/${full}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function somaDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

/** "2026-09" para agrupar comissoes/relatorios. */
export function referenciaMes(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function inicioDoMes(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function fimDoMes(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function inicioDoDia(d: Date = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function fimDoDia(d: Date = new Date()): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
