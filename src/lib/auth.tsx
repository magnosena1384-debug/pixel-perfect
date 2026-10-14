import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async (u: User | null) => {
      if (!active) return;
      setUser(u);
      if (u) {
        const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
        if (active) setIsAdmin(!!data);
      } else setIsAdmin(false);
      if (active) setLoading(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => load(s?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."],
  [
    /weak|easy to guess|pwned/i,
    "Essa senha é fraca ou já vazou em outros sites. Escolha uma senha diferente.",
  ],
  [
    /already registered|already been registered/i,
    "Este e-mail já tem cadastro. Faça login ou recupere sua senha.",
  ],
  [/rate limit|too many/i, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [/at least \d+ characters|password should be/i, "A senha precisa ter no mínimo 8 caracteres."],
  [/invalid.*email|email.*invalid/i, "E-mail inválido."],
  [/same.*password|different from the old/i, "A nova senha deve ser diferente da atual."],
  [/current password/i, "Senha atual incorreta."],
  [/session|jwt|expired/i, "Link expirado ou sessão inválida. Solicite um novo link."],
];

export function translateAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    AUTH_ERRORS.find(([re]) => re.test(msg))?.[1] ?? (msg || "Erro inesperado. Tente novamente.")
  );
}
