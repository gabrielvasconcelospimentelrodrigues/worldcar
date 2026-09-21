import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { FormularioLogin } from "./formulario";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  const { de } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado institucional */}
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

      {/* Formulario */}
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

          <FormularioLogin de={de} />

          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-carvao-500 transition hover:text-marca-600"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao site
          </Link>
        </div>
      </main>
    </div>
  );
}
