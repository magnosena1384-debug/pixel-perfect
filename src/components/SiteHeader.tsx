import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/** Logo dos Postos Lemon (public/logo-lemon.png). `tamanho` é o lado, em px. */
export function Logo({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Postos Lemon">
      <img
        src="/logo-lemon.png"
        alt="Lemon"
        width={tamanho}
        height={tamanho}
        className="rounded-xl"
      />
      <span className="hidden flex-col leading-none sm:flex">
        <span className="text-[10px] font-medium lowercase tracking-wide text-forest">postos</span>
        <span className="wordmark text-xl text-foreground">Lemon</span>
      </span>
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link to="/" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:inline">
            Cursos
          </Link>
          {user ? (
            <>
              <Link to="/gestao" className="rounded-full px-3 py-2 hover:bg-muted">
                Gestão
              </Link>
              <Link to="/meus-cursos" className="rounded-full px-3 py-2 hover:bg-muted">
                Meus cursos
              </Link>
              {isAdmin && (
                <Link to="/admin" className="rounded-full px-3 py-2 hover:bg-muted">
                  Admin
                </Link>
              )}
              <Link to="/perfil" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:inline">
                Perfil
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sair
              </Button>
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
