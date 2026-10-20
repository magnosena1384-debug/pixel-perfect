import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Painel } from "@/components/gestao/ui";
import { useUnidadesCom } from "@/lib/gestao";

export const Route = createFileRoute("/gestao/rh")({
  component: RhLayout,
});

function RhLayout() {
  const { unidades, isLoading } = useUnidadesCom("rh");
  const { unidades: podeImportar } = useUnidadesCom("rh-importar");

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!unidades.length)
    return (
      <Painel>
        <p>Você não tem acesso ao RH nesta unidade.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Peça ao administrador para liberar o módulo RH em Admin → Acessos.
        </p>
      </Painel>
    );

  const link = "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium hover:bg-background";
  return (
    <div className="space-y-6">
      <nav className="flex gap-2" aria-label="RH">
        <Link
          to="/gestao/rh"
          activeOptions={{ exact: true }}
          className={link}
          activeProps={{ className: "bg-forest text-secondary-foreground hover:bg-forest" }}
        >
          Painel
        </Link>
        {podeImportar.length > 0 && (
          <Link
            to="/gestao/rh/importar"
            className={link}
            activeProps={{ className: "bg-forest text-secondary-foreground hover:bg-forest" }}
          >
            Importar
          </Link>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
