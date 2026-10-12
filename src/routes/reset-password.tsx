import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/SiteHeader";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Lemon Operações" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Nova senha — Lemon Operações" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("Mínimo de 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return void toast.error(translateAuthError(error));
    toast.success("Senha atualizada!");
    navigate({ to: "/meus-cursos" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <Logo />
        <h1 className="text-3xl font-bold uppercase">Nova senha</h1>
        <Input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" className="w-full rounded-full font-semibold" size="lg">Salvar</Button>
      </form>
    </div>
  );
}
