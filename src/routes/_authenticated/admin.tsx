import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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

function AdminLayout() {
  const link = "rounded-full px-4 py-2 text-sm font-medium";
  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav className="mb-8 flex gap-2">
          <Link to="/admin" activeOptions={{ exact: true }} className={link} activeProps={{ className: "bg-ink text-cream" }}>Painel</Link>
          <Link to="/admin/alunos" className={link} activeProps={{ className: "bg-ink text-cream" }}>Alunos</Link>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
