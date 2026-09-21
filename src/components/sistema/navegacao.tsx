"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BellRing,
  Car,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  Wrench,
  X,
  ClipboardCheck,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { PAPEL } from "@/lib/constantes";
import { podeAcessar, type Sessao } from "@/lib/permissoes";
import { sairAction } from "@/app/login/actions";

const MENU = [
  { href: "/sistema", rotulo: "Painel", icone: LayoutDashboard, modulo: "dashboard" },
  { href: "/sistema/orcamentos", rotulo: "Orçamentos", icone: FileText, modulo: "orcamentos" },
  { href: "/sistema/ordens", rotulo: "Ordens de serviço", icone: ClipboardList, modulo: "ordens" },
  { href: "/sistema/vistorias", rotulo: "Vistorias", icone: ClipboardCheck, modulo: "vistorias" },
  { href: "/sistema/alertas", rotulo: "Alertas", icone: BellRing, modulo: "alertas", contador: true },
  { href: "/sistema/clientes", rotulo: "Clientes e veículos", icone: Car, modulo: "clientes" },
  { href: "/sistema/servicos", rotulo: "Catálogo de serviços", icone: Wrench, modulo: "servicos" },
  { href: "/sistema/financeiro", rotulo: "Financeiro", icone: Wallet, modulo: "financeiro" },
  { href: "/sistema/rh", rotulo: "RH", icone: Users, modulo: "rh" },
  { href: "/sistema/configuracoes", rotulo: "Configurações", icone: Settings, modulo: "configuracoes" },
] as const;

export function Navegacao({
  sessao,
  alertasPendentes,
}: {
  sessao: Sessao;
  alertasPendentes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  const itens = MENU.filter((m) => podeAcessar(sessao.papel, m.modulo));

  const ativo = (href: string) =>
    href === "/sistema" ? caminho === "/sistema" : caminho.startsWith(href);

  const lista = (
    <nav aria-label="Módulos do sistema" className="flex-1 space-y-0.5 px-3 py-4">
      {itens.map((m) => {
        const on = ativo(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={() => setAberto(false)}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              on
                ? "bg-marca-500 text-white"
                : "text-carvao-400 hover:bg-carvao-800 hover:text-white"
            }`}
          >
            <m.icone className="h-4.5 w-4.5 shrink-0" aria-hidden />
            <span className="flex-1">{m.rotulo}</span>
            {"contador" in m && m.contador && alertasPendentes > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  on ? "bg-white text-marca-600" : "bg-marca-500 text-white"
                }`}
              >
                {alertasPendentes > 99 ? "99+" : alertasPendentes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-carvao-800 p-3">
      <div className="px-2 py-2">
        <p className="truncate text-sm font-semibold text-white">{sessao.nome}</p>
        <p className="text-xs text-carvao-500">{PAPEL[sessao.papel]}</p>
      </div>
      <form action={sairAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-carvao-400 transition hover:bg-carvao-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Barra superior (mobile) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-carvao-800 bg-carvao-950 px-4 py-3 lg:hidden">
        <Link href="/sistema">
          <Logo tamanho="sm" invertido />
        </Link>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-md p-2 text-carvao-300 hover:bg-carvao-800 hover:text-white"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Menu lateral fixo (desktop) */}
      <aside className="rolagem-escura fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto bg-carvao-950 lg:flex">
        <div className="border-b border-carvao-800 px-5 py-4">
          <Link href="/sistema">
            <Logo tamanho="sm" invertido />
          </Link>
        </div>
        {lista}
        {rodape}
      </aside>

      {/* Gaveta (mobile) */}
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="rolagem-escura absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-carvao-950">
            <div className="flex items-center justify-between border-b border-carvao-800 px-5 py-4">
              <Logo tamanho="sm" invertido />
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-md p-1.5 text-carvao-400 hover:text-white"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {lista}
            {rodape}
          </aside>
        </div>
      )}
    </>
  );
}
