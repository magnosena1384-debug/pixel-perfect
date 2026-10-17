import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Postos Lemon" }] }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const [nome, setNome] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setNome(data?.nome ?? ""));
  }, [user.id]);

  async function saveName(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", user.id);
    if (error) toast.error(translateAuthError(error));
    else toast.success("Perfil salvo");
  }
  async function savePw(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("Mínimo de 8 caracteres.");
    const { error } = await supabase.auth.updateUser({
      password: pw,
      current_password: cur,
    } as never);
    if (error) return void toast.error(translateAuthError(error));
    toast.success("Senha alterada");
    setPw("");
    setCur("");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl space-y-10 px-4 py-12">
        <h1 className="text-4xl font-bold uppercase">Perfil</h1>
        <form onSubmit={saveName} className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Button type="submit" className="rounded-full">
            Salvar
          </Button>
        </form>
        <form onSubmit={savePw} className="space-y-4 rounded-3xl border bg-card p-6">
          <h2 className="font-bold uppercase">Alterar senha</h2>
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <Button type="submit" className="rounded-full">
            Alterar senha
          </Button>
        </form>
      </main>
    </div>
  );
}
