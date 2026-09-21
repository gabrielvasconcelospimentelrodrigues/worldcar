import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/componentes/logo";
import { Aviso, Botao, Campo } from "@/componentes/ui";
import { useSessao } from "@/lib/sessao-contexto";

export function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    const dados = new FormData(e.currentTarget);
    const falha = await entrar(
      String(dados.get("email") ?? ""),
      String(dados.get("senha") ?? ""),
    );

    if (falha) {
      setErro(falha);
      setEnviando(false);
      return;
    }
    const destino = (local.state as { de?: string } | null)?.de ?? "/sistema";
    navegar(destino, { replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-carvao-950 p-12 text-white lg:flex">
        <div aria-hidden className="listras-marca absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-marca-600/25 blur-3xl"
        />
        <div className="relative">
          <Logo tamanho="lg" invertido />
        </div>
        <div className="relative">
          <h2 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Sistema de
            <br />
            <span className="text-marca-500">gestão</span>
          </h2>
          <p className="mt-5 max-w-sm text-carvao-400">
            Orçamentos, ordens de serviço, vistorias, financeiro e RH — em um lugar só.
          </p>
        </div>
        <p className="relative text-xs text-carvao-600">
          Acesso restrito a colaboradores.
        </p>
      </aside>

      <main className="flex flex-col justify-center bg-white px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>

          <h1 className="mt-8 font-display text-3xl font-extrabold uppercase tracking-tight text-carvao-950 lg:mt-0">
            Entrar
          </h1>
          <p className="mt-1.5 text-sm text-carvao-500">
            Use as credenciais fornecidas pela administração.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            <Campo
              id="email"
              name="email"
              type="email"
              rotulo="E-mail"
              placeholder="voce@worldcarservice.com.br"
              autoComplete="username"
              required
            />
            <Campo
              id="senha"
              name="senha"
              type="password"
              rotulo="Senha"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {erro && <Aviso tipo="erro">{erro}</Aviso>}

            <Botao type="submit" disabled={enviando} className="w-full py-2.5">
              {enviando ? "Entrando..." : "Entrar"}
            </Botao>
          </form>
        </div>
      </main>
    </div>
  );
}
