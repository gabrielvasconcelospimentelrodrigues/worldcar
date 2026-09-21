import type { Papel } from "./tipos";

/**
 * Tipos e regras de acesso compartilhados entre servidor e cliente.
 * Fica separado de `auth.ts` porque aquele modulo e `server-only`
 * (usa Prisma e bcrypt) e o menu lateral precisa dessas regras no browser.
 */

export type Sessao = {
  usuarioId: string;
  email: string;
  papel: Papel;
  funcionarioId: string | null;
  nome: string;
};

export type Modulo =
  | "dashboard"
  | "orcamentos"
  | "ordens"
  | "vistorias"
  | "alertas"
  | "clientes"
  | "servicos"
  | "financeiro"
  | "rh"
  | "compras"
  | "relatorios"
  | "fidelidade"
  | "configuracoes";

export const PERMISSOES: Record<Modulo, Papel[]> = {
  dashboard: ["ADMIN", "GERENTE", "ATENDENTE", "TECNICO"],
  orcamentos: ["ADMIN", "GERENTE", "ATENDENTE"],
  ordens: ["ADMIN", "GERENTE", "ATENDENTE", "TECNICO"],
  vistorias: ["ADMIN", "GERENTE", "ATENDENTE", "TECNICO"],
  alertas: ["ADMIN", "GERENTE", "ATENDENTE"],
  clientes: ["ADMIN", "GERENTE", "ATENDENTE"],
  servicos: ["ADMIN", "GERENTE"],
  financeiro: ["ADMIN", "GERENTE"],
  rh: ["ADMIN", "GERENTE"],
  // Custo de peça revela margem: fora do alcance do técnico e do atendente.
  compras: ["ADMIN", "GERENTE"],
  // Relatório expõe faturamento e comissão de todo mundo.
  relatorios: ["ADMIN", "GERENTE"],
  // O atendente precisa consultar pontos do cliente no balcao.
  fidelidade: ["ADMIN", "GERENTE", "ATENDENTE"],
  configuracoes: ["ADMIN"],
};

export function podeAcessar(papel: Papel, modulo: Modulo) {
  return PERMISSOES[modulo].includes(papel);
}
