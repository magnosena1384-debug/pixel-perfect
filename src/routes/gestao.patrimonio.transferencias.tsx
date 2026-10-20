import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Painel, PilulaSituacao, Vazio } from "@/components/gestao/ui";
import { formatData, useUnidadesCom } from "@/lib/gestao";
import {
  cancelarTransferencia,
  receberTransferencia,
  useBens,
  useEmpresasDoGrupo,
  useTransferencias,
  type Transferencia,
} from "@/lib/patrimonio/dados";
import { formatarTombamento } from "@/lib/patrimonio/regras";

export const Route = createFileRoute("/gestao/patrimonio/transferencias")({
  component: Transferencias,
});

const SITUACAO: Record<Transferencia["situacao"], string> = {
  em_transito: "Em trânsito",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

function Transferencias() {
  const qc = useQueryClient();
  const { unidades } = useUnidadesCom("patrimonio");
  const { unidades: gerencia } = useUnidadesCom("patrimonio-gerenciar");
  const transferencias = useTransferencias();
  const bens = useBens();
  const empresas = useEmpresasDoGrupo();
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (transferencias.isLoading || bens.isLoading)
    return <p className="text-muted-foreground">Carregando…</p>;
  if (transferencias.error)
    return (
      <Painel>
        <Vazio>Não foi possível carregar: {transferencias.error.message}</Vazio>
      </Painel>
    );

  const nome = (id: string) => empresas.data?.find((e) => e.id === id)?.nome ?? "outra empresa";
  const bem = (id: string) => bens.data?.find((b) => b.id === id);
  const minhas = (id: string) => unidades.some((u) => u.id === id);
  const todas = transferencias.data ?? [];
  const aReceber = todas.filter((t) => t.situacao === "em_transito" && minhas(t.destinoId));
  // Quem tem a origem e também o destino (ex.: o admin) vê a transferência nas duas listas.
  const enviadas = todas.filter((t) => t.situacao === "em_transito" && minhas(t.origemId));
  const historico = todas.filter((t) => t.situacao !== "em_transito").slice(0, 30);

  async function agir(t: Transferencia, fazer: () => Promise<unknown>, mensagem: string) {
    setOcupado(t.id);
    try {
      await fazer();
      toast.success(mensagem);
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setOcupado(null);
    }
  }

  const linha = (t: Transferencia, acao?: React.ReactNode) => {
    const b = bem(t.bemId);
    return (
      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="text-sm">
          <p className="font-semibold">
            {b ? (
              <Link
                to="/gestao/patrimonio/bem/$id"
                params={{ id: b.id }}
                className="underline-offset-2 hover:underline"
              >
                <span className="font-mono">{formatarTombamento(b.tombamento)}</span> · {b.nome}
              </Link>
            ) : (
              "Bem transferido"
            )}
          </p>
          <p className="text-muted-foreground">
            {nome(t.origemId)} → {nome(t.destinoId)} · enviado em{" "}
            {formatData(t.enviadoEm.slice(0, 10))} por {t.enviadoPorNome || "—"}
            {t.observacao ? ` · ${t.observacao}` : ""}
          </p>
        </div>
        {acao}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <Painel titulo="A receber">
        {aReceber.length === 0 ? (
          <Vazio>Nenhum bem a caminho das suas empresas.</Vazio>
        ) : (
          <ul className="divide-y">
            {aReceber.map((t) =>
              linha(
                t,
                <Button
                  className="h-11 rounded-full"
                  disabled={ocupado === t.id}
                  onClick={() =>
                    void agir(
                      t,
                      () => receberTransferencia(t.id),
                      `Bem ${bem(t.bemId) ? formatarTombamento(bem(t.bemId)!.tombamento) : ""} agora é de ${nome(t.destinoId)}`,
                    )
                  }
                >
                  {ocupado === t.id ? "Gravando…" : "Confirmar recebimento"}
                </Button>,
              ),
            )}
          </ul>
        )}
      </Painel>

      <Painel titulo="Enviadas, em trânsito">
        {enviadas.length === 0 ? (
          <Vazio>Nenhuma transferência em trânsito saindo das suas empresas.</Vazio>
        ) : (
          <ul className="divide-y">
            {enviadas.map((t) =>
              linha(
                t,
                <div className="flex items-center gap-2">
                  <PilulaSituacao situacao="em_transito" />
                  {gerencia.some((u) => u.id === t.origemId) && (
                    <Button
                      variant="ghost"
                      disabled={ocupado === t.id}
                      onClick={() =>
                        confirm("Cancelar a transferência? O bem volta para a origem.") &&
                        void agir(t, () => cancelarTransferencia(t.id), "Transferência cancelada")
                      }
                    >
                      Cancelar
                    </Button>
                  )}
                </div>,
              ),
            )}
          </ul>
        )}
      </Painel>

      <Painel titulo="Histórico recente">
        {historico.length === 0 ? (
          <Vazio>Nenhuma transferência concluída ainda.</Vazio>
        ) : (
          <ul className="divide-y">
            {historico.map((t) =>
              linha(
                t,
                <span className="text-sm text-muted-foreground">
                  {SITUACAO[t.situacao]}
                  {t.concluidoEm ? ` em ${formatData(t.concluidoEm.slice(0, 10))}` : ""}
                  {t.concluidoPorNome ? ` por ${t.concluidoPorNome}` : ""}
                </span>,
              ),
            )}
          </ul>
        )}
      </Painel>
    </div>
  );
}
