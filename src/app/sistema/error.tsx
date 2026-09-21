"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { Botao, Cartao } from "@/components/ui";

/**
 * As ações do sistema lançam NAO_AUTENTICADO / SEM_PERMISSAO.
 * Aqui isso vira uma tela legível em vez de um erro genérico.
 */
export default function ErroSistema({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const semPermissao = error.message.includes("SEM_PERMISSAO");
  const naoAutenticado = error.message.includes("NAO_AUTENTICADO");
  const bancoIndisponivel =
    error.message.includes("DATABASE_URL") ||
    error.message.includes("Can't reach database") ||
    error.message.includes("P1001");

  if (semPermissao || naoAutenticado) {
    return (
      <Cartao className="mx-auto max-w-lg p-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-marca-500" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight text-carvao-950">
          {semPermissao ? "Sem permissão" : "Sessão expirada"}
        </h1>
        <p className="mt-2 text-sm text-carvao-600">
          {semPermissao
            ? "Seu nível de acesso não inclui esta área. Fale com a administração se precisar dela."
            : "Sua sessão terminou. Entre novamente para continuar."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href={semPermissao ? "/sistema" : "/login"}
            className="inline-flex items-center justify-center rounded-md bg-marca-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-marca-600"
          >
            {semPermissao ? "Voltar ao painel" : "Entrar novamente"}
          </Link>
        </div>
      </Cartao>
    );
  }

  return (
    <Cartao className="mx-auto max-w-lg p-10 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-marca-500" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight text-carvao-950">
        Algo deu errado
      </h1>
      <p className="mt-2 text-sm text-carvao-600">
        {bancoIndisponivel
          ? "Não foi possível falar com o banco de dados. Confira as variáveis DATABASE_URL e DIRECT_URL no .env.local."
          : "Ocorreu um erro inesperado nesta tela."}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-carvao-400">ref: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Botao type="button" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Tentar de novo
        </Botao>
        <Link
          href="/sistema"
          className="inline-flex items-center justify-center rounded-md border border-carvao-300 bg-white px-5 py-2 text-sm font-semibold text-carvao-800 transition hover:border-carvao-500"
        >
          Ir para o painel
        </Link>
      </div>
    </Cartao>
  );
}
