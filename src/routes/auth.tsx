import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/SiteHeader";
import { translateAuthError } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Postos Lemon" },
      { name: "description", content: "Acesse sua conta na plataforma Postos Lemon." },
      { property: "og:title", content: "Entrar — Postos Lemon" },
      { property: "og:description", content: "Acesse sua conta na plataforma Postos Lemon." },
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
      toast.error(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) toast.error("Não foi possível entrar com Google.");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-forest p-10 md:flex">
        <img
          src="/posto-lemon.jpg"
          alt="Posto Lemon ao entardecer, com a cobertura iluminada em verde"
          className="absolute inset-0 size-full object-cover object-[30%_60%]"
        />
        <img
          src="/logo-lemon.png"
          alt="Lemon"
          width={72}
          height={72}
          className="relative rounded-2xl"
        />
        <div className="relative w-fit rounded-3xl border border-cream/30 bg-forest/70 px-8 py-6 text-cream backdrop-blur-md">
          <p className="wordmark text-4xl text-cream">Postos Lemon</p>
          <p className="mt-2 text-lg font-medium text-cream">Gestão com Eficiência</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo tamanho={56} />
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
                  <Input
                    id="nome"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Senha</Label>
                  <Input
                    id="pw"
                    type="password"
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              {mode === "signup" && (
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1"
                  />
                  Li e aceito os termos de uso e a política de privacidade.
                </label>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="w-full rounded-full font-semibold"
                size="lg"
              >
                {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              </Button>
              {mode !== "forgot" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full"
                  size="lg"
                  onClick={google}
                >
                  Continuar com Google
                </Button>
              )}
            </form>
          )}
          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode !== "login" && (
              <button
                className="text-left text-forest hover:underline"
                onClick={() => {
                  setMode("login");
                  setSent(null);
                }}
              >
                Já tenho conta
              </button>
            )}
            {mode !== "signup" && (
              <button
                className="text-left text-forest hover:underline"
                onClick={() => {
                  setMode("signup");
                  setSent(null);
                }}
              >
                Criar uma conta
              </button>
            )}
            {mode === "login" && (
              <button
                className="text-left text-muted-foreground hover:underline"
                onClick={() => setMode("forgot")}
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
