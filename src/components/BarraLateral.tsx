import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import { Menu, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type ItemMenu = {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icone: LucideIcon;
  /** Só fica ativo na rota exata (ex.: o início de uma área). */
  exato?: boolean;
  selo?: ReactNode;
};
export type GrupoMenu = { titulo?: string; itens: ItemMenu[] };

function Itens({ grupos }: { grupos: GrupoMenu[] }) {
  return (
    <>
      {grupos.map((g, i) => (
        <div key={g.titulo ?? i} className={i ? "mt-5" : ""}>
          {g.titulo && <p className="eyebrow mb-1 px-3 text-cream/60">{g.titulo}</p>}
          <ul className="space-y-1">
            {g.itens.map(({ to, label, icone: Icone, exato, selo }) => (
              <li key={`${to}`}>
                <Link
                  to={to}
                  activeOptions={{ exact: !!exato }}
                  className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium hover:bg-cream/10"
                  activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
                >
                  <Icone className="size-[18px] shrink-0" aria-hidden />
                  <span className="flex-1">{label}</span>
                  {selo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Página com barra lateral à esquerda (no celular, a barra vira o botão "Menu"). */
export function AreaComBarra({
  grupos,
  titulo,
  children,
}: {
  grupos: GrupoMenu[];
  titulo?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:flex md:items-start md:gap-6 md:py-8">
      <aside className="md:sticky md:top-24 md:w-64 md:shrink-0">
        <button
          type="button"
          className="mb-4 flex min-h-11 w-full items-center justify-between rounded-2xl bg-ink px-4 text-sm font-semibold text-cream md:hidden"
          aria-expanded={aberto}
          aria-controls="menu-lateral"
          onClick={() => setAberto((v) => !v)}
        >
          <span>Menu</span>
          {aberto ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        <nav
          id="menu-lateral"
          aria-label={titulo ?? "Menu"}
          className={`${aberto ? "block" : "hidden"} mb-6 rounded-3xl bg-ink p-3 text-cream md:mb-0 md:block md:max-h-[calc(100vh-7rem)] md:overflow-y-auto`}
        >
          {titulo && <p className="eyebrow px-3 pb-3 pt-2 text-lime">{titulo}</p>}
          <Itens grupos={grupos} />
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
