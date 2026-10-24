import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Plug,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AreaComBarra, type GrupoMenu } from "@/components/BarraLateral";
import { SiteHeader } from "@/components/SiteHeader";
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
  useUnidadesCom,
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
  const { unidade, modulos, isLoading, isAdmin } = useUnidadeAtual();
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
  const { unidades: unidadesPatrimonio } = useUnidadesCom("patrimonio");
  const abas = MODULOS.filter((m) => modulos.has(m.id));
  const moduloDaRota = MODULOS.find((m) => pathname.startsWith(m.rota));
  const semAcessoAqui = moduloDaRota && !modulos.has(moduloDaRota.id);

  const selo =
    alertas.length > 0 ? (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${vencidos ? "bg-destructive text-destructive-foreground" : "bg-amber-400 text-black"}`}
      >
        {alertas.length}
      </span>
    ) : undefined;

  const operacao: GrupoMenu["itens"] = [];
  for (const a of abas) {
    operacao.push({ to: a.rota, label: a.label, icone: ICONES[a.id] });
    if (a.id === "vendas")
      operacao.push({ to: "/gestao/dashboard", label: "Dashboard", icone: LayoutDashboard });
  }
  // O RH e o Patrimônio reúnem todas as unidades em que a pessoa tem acesso, não só a selecionada.
  if (unidadesRh.length > 0) operacao.push({ to: "/gestao/rh", label: "RH", icone: Users });
  if (unidadesPatrimonio.length > 0)
    operacao.push({ to: "/gestao/patrimonio", label: "Patrimônio", icone: Boxes });

  const grupos: GrupoMenu[] = [
    { itens: [{ to: "/gestao", label: "Notificações", icone: Bell, exato: true, selo }] },
    { titulo: "Operação", itens: operacao },
    ...(isAdmin
      ? [
          {
            titulo: "Administração",
            itens: [
              { to: "/admin", label: "Painel", icone: LayoutGrid, exato: true },
              { to: "/admin/alunos", label: "Alunos", icone: GraduationCap },
              { to: "/admin/acessos", label: "Acessos", icone: KeyRound },
              { to: "/admin/webposto", label: "webPosto", icone: Plug },
            ],
          } satisfies GrupoMenu,
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <AreaComBarra grupos={grupos} titulo="Gestão com eficiência">
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
      </AreaComBarra>
    </div>
  );
}

const ICONES: Record<(typeof MODULOS)[number]["id"], LucideIcon> = {
  vendas: TrendingUp,
  rotinas: ClipboardList,
  pedidos: Package,
  documentos: FileText,
  manutencao: Wrench,
};

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
