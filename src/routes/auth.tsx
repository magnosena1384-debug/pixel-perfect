import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Lemon Operações" },
      { name: "description", content: "Acesse sua conta na plataforma Lemon Operações." },
      { property: "og:title", content: "Entrar — Lemon Operações" },
      { property: "og:description", content: "Acesse sua conta na plataforma Lemon Operações." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/meus-cursos" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/meus-cursos" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
        if (!consent) throw new Error("Aceite os termos e a política de privacidade.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { nome } },
        });
        if (error) throw error;
        setSent("Enviamos um link de confirmação para seu e-mail.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("Se o e-mail existir, você receberá um link para redefinir a senha.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="dot-grid relative hidden items-end p-10 md:flex">
        <div className="rounded-3xl bg-ink p-8 text-cream">
          <p className="wordmark text-5xl text-lime">Lemon</p>
          <p className="mt-2 text-lg">Treinamento que acompanha sua rotina.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo />
          <h1 className="mt-8 text-3xl font-bold uppercase">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h1>
          {sent ? (
            <div className="mt-6 rounded-2xl bg-accent p-4 text-sm">{sent}</div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Senha</Label>
                  <Input id="pw" type="password" required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              {mode === "signup" && (
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                  Li e aceito os termos de uso e a política de privacidade.
                </label>
              )}
              <Button type="submit" disabled={busy} className="w-full rounded-full font-semibold" size="lg">
                {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              </Button>
              {mode !== "forgot" && (
                <Button type="button" variant="outline" className="w-full rounded-full" size="lg" onClick={google}>
                  Continuar com Google
                </Button>
              )}
            </form>
          )}
          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode !== "login" && <button className="text-left text-forest hover:underline" onClick={() => { setMode("login"); setSent(null); }}>Já tenho conta</button>}
            {mode !== "signup" && <button className="text-left text-forest hover:underline" onClick={() => { setMode("signup"); setSent(null); }}>Criar uma conta</button>}
            {mode === "login" && <button className="text-left text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>Esqueci minha senha</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
