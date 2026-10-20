import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useUnidadesCom } from "@/lib/rh/dados";
import { Button } from "@/components/ui/button";
import { Painel } from "@/components/gestao/ui";
import {
  dadosDoNavegador,
  gravarDiferencas,
  hoje,
  limparDadosDoNavegador,
  MODULOS,
  useAlertas,
  useAlertasPorUnidade,
  useUnidadeAtual,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Gestão do Posto — Postos Lemon" }] }),
  component: GestaoLayout,
});

function GestaoLayout() {
  const { unidade, modulos, isLoading } = useUnidadeAtual();
  const { pathname } = useLocation();
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

  const { unidades: unidadesRh } = useUnidadesCom("rh");
  const abas = MODULOS.filter((m) => modulos.has(m.id));
  const moduloDaRota = MODULOS.find((m) => pathname.startsWith(m.rota));
  const semAcessoAqui = moduloDaRota && !modulos.has(moduloDaRota.id);

  const link = "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium hover:bg-background";
  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-bold uppercase">Gestão do posto</h1>
          {unidade && <SeletorUnidade />}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : !unidade ? (
          <Painel>
            <p>Você ainda não tem acesso a nenhuma unidade.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Peça ao administrador para liberar seu acesso em Admin → Acessos.
            </p>
          </Painel>
        ) : (
          <>
            <nav className="mb-8 flex gap-2 overflow-x-auto pb-1">
              <Link
                to="/gestao"
                activeOptions={{ exact: true }}
                className={link}
                activeProps={{ className: "bg-ink text-cream hover:bg-ink" }}
              >
                Notificações
                {alertas.length > 0 && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${vencidos ? "bg-destructive text-destructive-foreground" : "bg-amber-400 text-black"}`}
                  >
                    {alertas.length}
                  </span>
                )}
              </Link>
              {abas.map((a) => (
                <Fragment key={a.id}>
                  <Link
                    to={a.rota}
                    className={link}
                    activeProps={{ className: "bg-ink text-cream hover:bg-ink" }}
                  >
                    {a.label}
                  </Link>
                  {a.id === "vendas" && (
                    <Link
                      to="/gestao/dashboard"
                      className={link}
                      activeProps={{ className: "bg-ink text-cream hover:bg-ink" }}
                    >
                      Dashboard
                    </Link>
                  )}
                </Fragment>
              ))}
              {/* O RH reúne todas as unidades em que a pessoa tem acesso, não só a selecionada. */}
              {unidadesRh.length > 0 && (
                <Link
                  to="/gestao/rh"
                  className={link}
                  activeProps={{ className: "bg-ink text-cream hover:bg-ink" }}
                >
                  RH
                </Link>
              )}
            </nav>
            <ImportarDoNavegador />
            {semAcessoAqui ? (
              <Painel>
                <p>Você não tem acesso a {moduloDaRota.label} nesta unidade.</p>
              </Painel>
            ) : (
              <Outlet />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SeletorUnidade() {
  const { unidade, unidades, selecionar } = useUnidadeAtual();
  const { data: contagem } = useAlertasPorUnidade();
  if (unidades.length <= 1) return <p className="text-lg font-semibold">{unidade?.nome}</p>;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="unidade" className="text-sm font-medium">
        Unidade
      </label>
      <select
        id="unidade"
        value={unidade?.id}
        onChange={(e) => selecionar(e.target.value)}
        className="h-9 max-w-[22rem] rounded-full border bg-card px-4 text-sm font-semibold"
      >
        {unidades.map((u) => {
          const n = contagem?.get(u.id) ?? 0;
          return (
            <option key={u.id} value={u.id}>
              {u.nome}
              {n ? ` · ${n} alerta${n > 1 ? "s" : ""}` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// Antes de ir para o banco, a gestão guardava tudo no navegador. O admin pode trazer esses
// dados para a unidade escolhida uma única vez.
function ImportarDoNavegador() {
  const qc = useQueryClient();
  const { unidade, isAdmin } = useUnidadeAtual();
  const [achados, setAchados] = useState(dadosDoNavegador);
  const [enviando, setEnviando] = useState(false);
  if (!isAdmin || !unidade || achados.length === 0) return null;
  const total = achados.reduce((s, a) => s + a.itens.length, 0);

  async function importar() {
    if (!unidade) return;
    setEnviando(true);
    try {
      for (const a of achados) await gravarDiferencas(unidade.id, a.colecao, [], a.itens);
      limparDadosDoNavegador();
      setAchados([]);
      toast.success(`${total} registro(s) importado(s) para ${unidade.nome}`);
      void qc.invalidateQueries({ queryKey: ["gestao"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Painel className="mb-8 border-2 border-amber-400">
      <p className="font-semibold">
        Há {total} registro(s) da gestão salvos só neste navegador (de antes das unidades).
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha a unidade certa no seletor acima e importe. Depois disso, os dados ficam no sistema
        e aparecem em qualquer computador.
      </p>
      <div className="mt-4 flex gap-2">
        <Button className="rounded-full" disabled={enviando} onClick={importar}>
          {enviando ? "Importando…" : `Importar para ${unidade.nome}`}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (!confirm("Descartar os dados salvos neste navegador?")) return;
            limparDadosDoNavegador();
            setAchados([]);
          }}
        >
          Descartar
        </Button>
      </div>
    </Painel>
  );
}
