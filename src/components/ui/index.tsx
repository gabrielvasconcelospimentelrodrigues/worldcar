import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ============================================================
   Primitivas de UI do sistema. Paleta: preto / branco / vermelho.
   ============================================================ */

export function Badge({
  children,
  cor = "bg-carvao-200 text-carvao-800",
  className = "",
}: {
  children: ReactNode;
  cor?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cor} ${className}`}
    >
      {children}
    </span>
  );
}

type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo";

const ESTILO_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-marca-500 text-white hover:bg-marca-600 disabled:bg-marca-300",
  secundario:
    "bg-carvao-950 text-white hover:bg-carvao-800 disabled:bg-carvao-400",
  fantasma:
    "border border-carvao-300 bg-white text-carvao-800 hover:border-carvao-500 hover:bg-carvao-50",
  perigo: "border border-marca-300 bg-white text-marca-700 hover:bg-marca-50",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: VarianteBotao }) {
  return (
    <button
      {...props}
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${className}`}
    />
  );
}

export function BotaoLink({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: VarianteBotao }) {
  return (
    <Link
      {...props}
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${className}`}
    />
  );
}

export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-carvao-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CabecalhoCartao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-carvao-200 px-5 py-4">
      <div>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
          {titulo}
        </h2>
        {descricao && <p className="mt-0.5 text-sm text-carvao-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function TituloPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 text-sm text-carvao-500">{descricao}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </div>
  );
}

/* ---------------- Campos de formulario ---------------- */

const BASE_CAMPO =
  "w-full rounded-md border border-carvao-300 bg-white px-3 py-2 text-sm text-carvao-950 placeholder:text-carvao-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20 disabled:bg-carvao-100";

export function Rotulo({
  children,
  htmlFor,
  obrigatorio,
}: {
  children: ReactNode;
  htmlFor?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-carvao-600"
    >
      {children}
      {obrigatorio && <span className="ml-0.5 text-marca-500">*</span>}
    </label>
  );
}

export function Campo({
  rotulo,
  id,
  dica,
  className = "",
  ...props
}: ComponentProps<"input"> & { rotulo?: string; dica?: string }) {
  return (
    <div className={className}>
      {rotulo && (
        <Rotulo htmlFor={id} obrigatorio={props.required}>
          {rotulo}
        </Rotulo>
      )}
      <input id={id} {...props} className={BASE_CAMPO} />
      {dica && <p className="mt-1 text-xs text-carvao-500">{dica}</p>}
    </div>
  );
}

export function AreaTexto({
  rotulo,
  id,
  dica,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { rotulo?: string; dica?: string }) {
  return (
    <div className={className}>
      {rotulo && (
        <Rotulo htmlFor={id} obrigatorio={props.required}>
          {rotulo}
        </Rotulo>
      )}
      <textarea id={id} rows={3} {...props} className={BASE_CAMPO} />
      {dica && <p className="mt-1 text-xs text-carvao-500">{dica}</p>}
    </div>
  );
}

export function Selecao({
  rotulo,
  id,
  dica,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { rotulo?: string; dica?: string }) {
  return (
    <div className={className}>
      {rotulo && (
        <Rotulo htmlFor={id} obrigatorio={props.required}>
          {rotulo}
        </Rotulo>
      )}
      <select id={id} {...props} className={BASE_CAMPO}>
        {children}
      </select>
      {dica && <p className="mt-1 text-xs text-carvao-500">{dica}</p>}
    </div>
  );
}

/* ---------------- Tabela ---------------- */

export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-carvao-200 bg-carvao-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-carvao-600 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-carvao-100 px-4 py-3 align-middle text-carvao-800 ${className}`}
    >
      {children}
    </td>
  );
}

export function LinhaVazia({
  colunas,
  mensagem = "Nenhum registro encontrado.",
}: {
  colunas: number;
  mensagem?: string;
}) {
  return (
    <tr>
      <Td colSpan={colunas} className="py-10 text-center text-carvao-500">
        {mensagem}
      </Td>
    </tr>
  );
}

/* ---------------- Indicadores ---------------- */

export function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque,
  icone,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  icone?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        destaque
          ? "border-marca-200 bg-marca-50"
          : "border-carvao-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
          {rotulo}
        </p>
        {icone && <span className="text-marca-500">{icone}</span>}
      </div>
      <p
        className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${
          destaque ? "text-marca-600" : "text-carvao-950"
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-carvao-500">{detalhe}</p>}
    </div>
  );
}

export function Aviso({
  tipo = "info",
  children,
}: {
  tipo?: "info" | "erro" | "sucesso";
  children: ReactNode;
}) {
  const estilo = {
    info: "border-carvao-200 bg-carvao-50 text-carvao-700",
    erro: "border-marca-200 bg-marca-50 text-marca-700",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tipo];
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${estilo}`} role="status">
      {children}
    </div>
  );
}

/** Par rotulo/valor para telas de detalhe. */
export function Dado({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm text-carvao-900">{children || "-"}</dd>
    </div>
  );
}
