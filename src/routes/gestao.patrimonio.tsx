import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Painel } from "@/components/gestao/ui";
import { useUnidadesCom } from "@/lib/gestao";

export const Route = createFileRoute("/gestao/patrimonio")({
  component: PatrimonioLayout,
});

function PatrimonioLayout() {
  const { unidades, isLoading } = useUnidadesCom("patrimonio");
  const { unidades: gerencia } = useUnidadesCom("patrimonio-gerenciar");

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!unidades.length)
    return (
      <Painel>
        <p>Você não tem acesso ao Patrimônio nesta empresa.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Peça ao administrador para liberar o módulo Patrimônio em Admin → Acessos.
        </p>
      </Painel>
    );

  const link = "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium hover:bg-background";
  const ativo = { className: "bg-forest text-secondary-foreground hover:bg-forest" };
  return (
    <div className="space-y-6">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Patrimônio">
        <Link
          to="/gestao/patrimonio"
          activeOptions={{ exact: true }}
          className={link}
          activeProps={ativo}
        >
          Bens
        </Link>
        <Link to="/gestao/patrimonio/inventario" className={link} activeProps={ativo}>
          Inventário
        </Link>
        {gerencia.length > 0 && (
          <Link to="/gestao/patrimonio/etiquetas" className={link} activeProps={ativo}>
            Etiquetas
          </Link>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
