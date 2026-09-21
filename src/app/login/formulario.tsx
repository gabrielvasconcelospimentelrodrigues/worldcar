"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Aviso, Botao, Campo } from "@/components/ui";
import { entrarAction, type EstadoLogin } from "./actions";

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="w-full py-2.5">
      {pending ? "Entrando..." : "Entrar"}
    </Botao>
  );
}

export function FormularioLogin({ de }: { de?: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrarAction, {});

  return (
    <form action={acao} className="mt-8 space-y-4">
      <input type="hidden" name="de" value={de ?? "/sistema"} />

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

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <BotaoEnviar />
    </form>
  );
}
