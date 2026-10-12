import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { hoje, useAlertas } from "@/lib/gestao";

export const Route = createFileRoute("/gestao")({
  // Os dados ficam no navegador (localStorage), então não há o que renderizar no servidor.
  ssr: false,
  head: () => ({ meta: [{ title: "Gestão do Posto — Lemon Operações" }] }),
  component: GestaoLayout,
});

const abas = [
  { to: "/gestao", label: "Notificações", exact: true },
  { to: "/gestao/vendas", label: "Vendas" },
  { to: "/gestao/rotinas", label: "Rotinas administrativas" },
  { to: "/gestao/pedidos", label: "Pedidos" },
  { to: "/gestao/regulacao", label: "Regulação" },
  { to: "/gestao/manutencao", label: "Manutenção e inspeção" },
] as const;

function GestaoLayout() {
  const alertas = useAlertas();
  const vencidos = alertas.filter((a) => a.situacao === "vencido").length;

  // Notificação do navegador uma vez por dia, se o usuário tiver permitido.
  useEffect(() => {
    if (
      !alertas.length ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    try {
      if (localStorage.getItem("gestao:ultimo-aviso") === hoje()) return;
      localStorage.setItem("gestao:ultimo-aviso", hoje());
    } catch {
      return;
    }
    new Notification("Gestão do Posto", {
      body: `${vencidos} vencido(s) e ${alertas.length - vencidos} a vencer. Abra a aba Notificações.`,
    });
  }, [alertas.length, vencidos]);

  const link = "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium hover:bg-background";
  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-4xl font-bold uppercase">Gestão do posto</h1>
        <nav className="mb-8 flex gap-2 overflow-x-auto pb-1">
          {abas.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              activeOptions={{ exact: "exact" in a }}
              className={link}
              activeProps={{ className: "bg-ink text-cream hover:bg-ink" }}
            >
              {a.label}
              {a.to === "/gestao" && alertas.length > 0 && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${vencidos ? "bg-destructive text-destructive-foreground" : "bg-amber-400 text-black"}`}
                >
                  {alertas.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
