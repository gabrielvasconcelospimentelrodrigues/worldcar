import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, BellRing, Car, Gift, ClipboardCheck, ClipboardList, FileText, LayoutDashboard,
  LogOut, Menu, Scale, Settings, Truck, Users, Wallet, Wrench, X,
} from "lucide-react";
import { Logo } from "@/componentes/logo";
import { PAPEL } from "@/lib/constantes";
import { useContadores } from "@/lib/contadores";
import { useSessao } from "@/lib/sessao-contexto";
import type { Modulo } from "@/lib/permissoes";

const MENU: { para: string; rotulo: string; icone: typeof Car; modulo: Modulo }[] = [
  { para: "/sistema", rotulo: "Painel", icone: LayoutDashboard, modulo: "dashboard" },
  { para: "/sistema/orcamentos", rotulo: "Orçamentos", icone: FileText, modulo: "orcamentos" },
  { para: "/sistema/ordens", rotulo: "Ordens de serviço", icone: ClipboardList, modulo: "ordens" },
  { para: "/sistema/vistorias", rotulo: "Vistorias", icone: ClipboardCheck, modulo: "vistorias" },
  { para: "/sistema/alertas", rotulo: "Alertas", icone: BellRing, modulo: "alertas" },
  { para: "/sistema/clientes", rotulo: "Clientes e veículos", icone: Car, modulo: "clientes" },
  { para: "/sistema/servicos", rotulo: "Catálogo de serviços", icone: Wrench, modulo: "servicos" },
  { para: "/sistema/cotacoes", rotulo: "Cotações", icone: Scale, modulo: "compras" },
  { para: "/sistema/fornecedores", rotulo: "Fornecedores", icone: Truck, modulo: "compras" },
  { para: "/sistema/financeiro", rotulo: "Financeiro", icone: Wallet, modulo: "financeiro" },
  { para: "/sistema/rh", rotulo: "RH", icone: Users, modulo: "rh" },
  { para: "/sistema/relatorios", rotulo: "Relatórios", icone: BarChart3, modulo: "relatorios" },
  { para: "/sistema/fidelidade", rotulo: "Fidelidade", icone: Gift, modulo: "fidelidade" },
  { para: "/sistema/configuracoes", rotulo: "Configurações", icone: Settings, modulo: "configuracoes" },
];

export function LayoutSistema() {
  const [aberto, setAberto] = useState(false);
  const { perfil, eu, sair, pode } = useSessao();
  const { contadores } = useContadores();
  const navegar = useNavigate();

  const itens = MENU.filter((m) => pode(m.modulo));

  async function encerrar() {
    await sair();
    navegar("/entrar", { replace: true });
  }

  const lista = (
    <nav aria-label="Módulos do sistema" className="flex-1 space-y-0.5 px-3 py-4">
      {itens.map((m) => {
        const pendentes = contadores[m.modulo] ?? 0;
        return (
          <NavLink
            key={m.para}
            to={m.para}
            end={m.para === "/sistema"}
            onClick={() => setAberto(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-marca-500 text-white"
                  : "text-carvao-400 hover:bg-carvao-800 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <m.icone className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{m.rotulo}</span>
                {pendentes > 0 && (
                  <span
                    // aria-label porque so o numero nao diz nada a quem usa leitor
                    // de tela: "3" sozinho num menu nao significa coisa alguma.
                    aria-label={`${pendentes} ${pendentes === 1 ? "item precisa" : "itens precisam"} de atencao`}
                    // No item ativo o fundo ja e vermelho: a bolinha inverte para
                    // nao desaparecer dentro dele.
                    className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                      isActive ? "bg-white text-marca-600" : "bg-marca-500 text-white"
                    }`}
                  >
                    {pendentes > 99 ? "99+" : pendentes}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-carvao-800 p-3">
      <div className="px-2 py-2">
        <p className="truncate text-sm font-semibold text-white">
          {eu?.nome ?? "Usuário"}
        </p>
        <p className="text-xs text-carvao-500">{perfil ? PAPEL[perfil.papel] : ""}</p>
      </div>
      <button
        type="button"
        onClick={encerrar}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-carvao-400 transition hover:bg-carvao-800 hover:text-white"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-carvao-50">
      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-carvao-800 bg-carvao-950 px-4 py-3 lg:hidden">
        <Logo tamanho="sm" invertido />
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-md p-2 text-carvao-300 hover:bg-carvao-800 hover:text-white"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Menu lateral (desktop) */}
      <aside className="rolagem-escura fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto bg-carvao-950 lg:flex">
        <div className="border-b border-carvao-800 px-5 py-4">
          <Logo tamanho="sm" invertido />
        </div>
        {lista}
        {rodape}
      </aside>

      {/* Gaveta (celular) */}
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

      <div className="lg:pl-60">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
