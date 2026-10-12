import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex flex-col leading-none">
      <span className={`text-[10px] font-medium lowercase tracking-wide ${inverted ? "text-lime" : "text-forest"}`}>
        postos
      </span>
      <span className={`wordmark text-2xl ${inverted ? "text-background" : "text-foreground"}`}>Lemon</span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link to="/" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:inline">Cursos</Link>
          {user ? (
            <>
              <Link to="/gestao" className="rounded-full px-3 py-2 hover:bg-muted">Gestão</Link>
              <Link to="/meus-cursos" className="rounded-full px-3 py-2 hover:bg-muted">Meus cursos</Link>
              {isAdmin && <Link to="/admin" className="rounded-full px-3 py-2 hover:bg-muted">Admin</Link>}
              <Link to="/perfil" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:inline">Perfil</Link>
              <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full font-semibold">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
