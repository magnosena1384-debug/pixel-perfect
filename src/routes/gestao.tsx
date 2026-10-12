import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alertasDaUnidade, hoje, useAlertas, useUnidadeAtual, useUnidades } from "@/lib/gestao";

export const Route = createFileRoute("/gestao")({
  // Os dados ficam no navegador (localStorage), então não há o que renderizar no servidor.
  ssr: false,
  head: () => ({ meta: [{ title: "Gestão do Posto — Postos Lemon" }] }),
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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-bold uppercase">Gestão do posto</h1>
          <SeletorUnidade />
        </div>
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

function SeletorUnidade() {
  const [unidades, salvarUnidades] = useUnidades();
  const [atual, selecionar] = useUnidadeAtual();
  // Recalcula a contagem quando qualquer dado da gestão muda (useAlertas assina o armazenamento).
  useAlertas();

  function renomear() {
    const nome = prompt("Nome da unidade", atual.nome)?.trim();
    if (!nome) return;
    salvarUnidades((l) => l.map((u) => (u.id === atual.id ? { ...u, nome } : u)));
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="unidade" className="text-sm font-medium">
        Unidade
      </label>
      <select
        id="unidade"
        value={atual.id}
        onChange={(e) => selecionar(e.target.value)}
        className="h-9 rounded-full border bg-card px-4 text-sm font-semibold"
      >
        {unidades.map((u) => {
          const n = alertasDaUnidade(u.id).length;
          return (
            <option key={u.id} value={u.id}>
              {u.nome}
              {n ? ` · ${n} alerta${n > 1 ? "s" : ""}` : ""}
            </option>
          );
        })}
      </select>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={renomear}
        aria-label="Renomear unidade"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
