import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Building2, GraduationCap, KeyRound, LayoutGrid, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AreaComBarra, type GrupoMenu } from "@/components/BarraLateral";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/meus-cursos" });
  },
  head: () => ({ meta: [{ title: "Admin — Postos Lemon" }] }),
  component: AdminLayout,
});

const GRUPOS: GrupoMenu[] = [
  {
    titulo: "Administração",
    itens: [
      { to: "/admin", label: "Painel", icone: LayoutGrid, exato: true },
      { to: "/admin/alunos", label: "Alunos", icone: GraduationCap },
      { to: "/admin/acessos", label: "Acessos", icone: KeyRound },
      { to: "/admin/webposto", label: "webPosto", icone: Plug },
    ],
  },
  { titulo: "Ir para", itens: [{ to: "/gestao", label: "Gestão do posto", icone: Building2 }] },
];

function AdminLayout() {
  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <AreaComBarra grupos={GRUPOS} titulo="Gestão de eficiência">
        <Outlet />
      </AreaComBarra>
    </div>
  );
}
