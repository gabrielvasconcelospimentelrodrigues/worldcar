import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { carregarPerfil, sb, type Perfil } from "./supabase";
import { podeAcessar, type Modulo } from "./permissoes";
import { ContextoSessao, type EstadoSessao } from "./sessao-contexto";
import type { MembroEquipe } from "./tipos";


export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [eu, setEu] = useState<MembroEquipe | null>(null);

  const aplicar = useCallback(async (s: Session | null) => {
    setSessao(s);
    if (!s?.user) {
      setPerfil(null);
      setEu(null);
      return;
    }
    const p = await carregarPerfil(s.user.id);
    setPerfil(p);

    if (p?.funcionario_id) {
      const { data } = await sb
        .from("equipe")
        .select("id, nome, cargo, setor, ativo")
        .eq("id", p.funcionario_id)
        .maybeSingle();
      setEu((data as MembroEquipe) ?? null);
    } else {
      setEu(null);
    }
  }, []);

  useEffect(() => {
    let vivo = true;

    sb.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      await aplicar(data.session);
      if (vivo) setCarregando(false);
    });

    // Cobre login, logout e renovacao do token em outras abas
    const { data: assinatura } = sb.auth.onAuthStateChange((_evento, s) => {
      if (vivo) void aplicar(s);
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) {
      return error.message.includes("Invalid login")
        ? "E-mail ou senha incorretos."
        : error.message;
    }
    const p = data.session ? await carregarPerfil(data.session.user.id) : null;
    if (!p || !p.ativo) {
      await sb.auth.signOut();
      return "Seu acesso está bloqueado. Fale com a administração.";
    }
    return null;
  }, []);

  const sair = useCallback(async () => {
    await sb.auth.signOut();
  }, []);

  const pode = useCallback(
    (modulo: Modulo) => (perfil ? podeAcessar(perfil.papel, modulo) : false),
    [perfil],
  );

  const valor = useMemo<EstadoSessao>(
    () => ({ carregando, sessao, perfil, eu, entrar, sair, pode }),
    [carregando, sessao, perfil, eu, entrar, sair, pode],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

