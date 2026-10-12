import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Painel, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import { formatData, useAlertas } from "@/lib/gestao";

export const Route = createFileRoute("/gestao/")({
  component: Notificacoes,
});

function Notificacoes() {
  const alertas = useAlertas();
  const [permissao, setPermissao] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const vencidos = alertas.filter((a) => a.situacao === "vencido");
  const proximos = alertas.filter((a) => a.situacao === "proximo");

  async function ativar() {
    const p = await Notification.requestPermission();
    setPermissao(p);
    if (p === "granted") toast.success("Avisos do navegador ativados");
    else toast.error("Permissão negada no navegador");
  }

  const cards = [
    {
      label: "Vencidos / pendentes",
      value: vencidos.length,
      cls: "bg-destructive text-destructive-foreground",
    },
    { label: "A vencer", value: proximos.length, cls: "bg-amber-400 text-black" },
    {
      label: "Documentos",
      value: alertas.filter((a) => a.tipo === "Documento").length,
      cls: "bg-card",
    },
    {
      label: "Manutenções",
      value: alertas.filter((a) => a.tipo === "Manutenção").length,
      cls: "bg-card",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-3xl p-6 ${c.cls}`}>
            <p className="eyebrow opacity-70">{c.label}</p>
            <p className="mt-2 text-4xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <Painel
        titulo="Notificações de vencimento"
        acao={
          permissao === "default" && (
            <Button variant="outline" className="rounded-full" onClick={ativar}>
              Ativar avisos no navegador
            </Button>
          )
        }
      >
        {alertas.length === 0 ? (
          <Vazio>
            Nada vencido ou a vencer. Cadastre documentos em Regulação e registre inspeções em
            Manutenção.
          </Vazio>
        ) : (
          <div className="divide-y">
            {alertas.map((a) => (
              <Link
                key={`${a.tipo}-${a.id}`}
                to={a.link}
                className="flex flex-wrap items-center justify-between gap-2 py-4 hover:bg-muted/50"
              >
                <div>
                  <p className="font-semibold">{a.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.tipo} · {a.detalhe} ·{" "}
                    {a.vencimento ? `vence em ${formatData(a.vencimento)}` : "nunca registrado"}
                  </p>
                </div>
                <SituacaoBadge situacao={a.situacao} vencimento={a.vencimento} />
              </Link>
            ))}
          </div>
        )}
      </Painel>
    </div>
  );
}
