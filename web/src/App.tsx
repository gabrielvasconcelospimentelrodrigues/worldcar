import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useSessao } from "./lib/sessao-contexto";
import type { Modulo } from "./lib/permissoes";
import { Logo } from "./componentes/logo";
import { LayoutSistema } from "./telas/layout";
import { Entrar } from "./telas/entrar";
import { Site } from "./telas/site";
import { Painel } from "./telas/painel";
import { Clientes } from "./telas/clientes";
import { FichaCliente } from "./telas/cliente-ficha";
import { Servicos } from "./telas/servicos";
import { Orcamentos } from "./telas/orcamentos";
import { EditorOrcamento } from "./telas/orcamento-editor";
import { FichaOrcamento } from "./telas/orcamento-ficha";
import { Ordens } from "./telas/ordens";
import { NovaOrdem } from "./telas/ordem-nova";
import { FichaOrdem } from "./telas/ordem-ficha";
import { Vistorias } from "./telas/vistorias";
import { NovaVistoria } from "./telas/vistoria-nova";
import { FichaVistoria } from "./telas/vistoria-ficha";
import { Alertas } from "./telas/alertas";
import { Financeiro } from "./telas/financeiro";
import { RH } from "./telas/rh";
import { Relatorios } from "@/telas/relatorios";
import { ProgramaFidelidade } from "@/telas/fidelidade";
import { Configuracoes } from "./telas/configuracoes";
import { Fornecedores } from "./telas/fornecedores";
import { Cotacoes } from "./telas/cotacoes";
import { NovaCotacao } from "./telas/cotacao-nova";
import { FichaCotacao } from "./telas/cotacao-ficha";

function Carregando() {
  return (
    <div className="grid min-h-screen place-items-center bg-carvao-950">
      <div className="text-center">
        <Logo tamanho="lg" invertido />
        <p className="mt-6 text-sm text-carvao-400">Carregando...</p>
      </div>
    </div>
  );
}

/** Exige login; opcionalmente exige acesso a um modulo. */
function Protegida({ modulo, children }: { modulo?: Modulo; children: ReactNode }) {
  const { carregando, sessao, perfil, pode } = useSessao();
  const local = useLocation();

  if (carregando) return <Carregando />;
  if (!sessao || !perfil) {
    return <Navigate to="/entrar" state={{ de: local.pathname }} replace />;
  }
  if (modulo && !pode(modulo)) {
    return <Navigate to="/sistema" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const { carregando, sessao } = useSessao();

  return (
    <Routes>
      {/* Site institucional, publico */}
      <Route path="/" element={<Site />} />

      <Route
        path="/entrar"
        element={
          carregando ? <Carregando /> : sessao ? <Navigate to="/sistema" replace /> : <Entrar />
        }
      />

      <Route
        path="/sistema"
        element={
          <Protegida>
            <LayoutSistema />
          </Protegida>
        }
      >
        <Route index element={<Painel />} />
        <Route
          path="clientes"
          element={<Protegida modulo="clientes"><Clientes /></Protegida>}
        />
        <Route
          path="clientes/novo"
          element={<Protegida modulo="clientes"><FichaCliente criando /></Protegida>}
        />
        <Route
          path="clientes/:id"
          element={<Protegida modulo="clientes"><FichaCliente /></Protegida>}
        />
        <Route
          path="servicos"
          element={<Protegida modulo="servicos"><Servicos /></Protegida>}
        />
        <Route
          path="orcamentos"
          element={<Protegida modulo="orcamentos"><Orcamentos /></Protegida>}
        />
        <Route
          path="orcamentos/novo"
          element={<Protegida modulo="orcamentos"><EditorOrcamento /></Protegida>}
        />
        <Route
          path="orcamentos/:id"
          element={<Protegida modulo="orcamentos"><FichaOrcamento /></Protegida>}
        />
        <Route
          path="orcamentos/:id/editar"
          element={<Protegida modulo="orcamentos"><EditorOrcamento /></Protegida>}
        />

        <Route
          path="ordens"
          element={<Protegida modulo="ordens"><Ordens /></Protegida>}
        />
        <Route
          path="ordens/nova"
          element={<Protegida modulo="ordens"><NovaOrdem /></Protegida>}
        />
        <Route
          path="ordens/:id"
          element={<Protegida modulo="ordens"><FichaOrdem /></Protegida>}
        />
        <Route
          path="vistorias"
          element={<Protegida modulo="vistorias"><Vistorias /></Protegida>}
        />
        <Route
          path="vistorias/nova"
          element={<Protegida modulo="vistorias"><NovaVistoria /></Protegida>}
        />
        <Route
          path="vistorias/:id"
          element={<Protegida modulo="vistorias"><FichaVistoria /></Protegida>}
        />
        <Route
          path="alertas"
          element={<Protegida modulo="alertas"><Alertas /></Protegida>}
        />
        <Route
          path="financeiro"
          element={<Protegida modulo="financeiro"><Financeiro /></Protegida>}
        />
        <Route
          path="rh"
          element={<Protegida modulo="rh"><RH /></Protegida>}
        />
        <Route
          path="fornecedores"
          element={<Protegida modulo="compras"><Fornecedores /></Protegida>}
        />
        <Route
          path="cotacoes"
          element={<Protegida modulo="compras"><Cotacoes /></Protegida>}
        />
        <Route
          path="cotacoes/nova"
          element={<Protegida modulo="compras"><NovaCotacao /></Protegida>}
        />
        <Route
          path="cotacoes/:id"
          element={<Protegida modulo="compras"><FichaCotacao /></Protegida>}
        />
        <Route
          path="relatorios"
          element={<Protegida modulo="relatorios"><Relatorios /></Protegida>}
        />
        <Route
          path="fidelidade"
          element={<Protegida modulo="fidelidade"><ProgramaFidelidade /></Protegida>}
        />
        <Route
          path="configuracoes"
          element={<Protegida modulo="configuracoes"><Configuracoes /></Protegida>}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
