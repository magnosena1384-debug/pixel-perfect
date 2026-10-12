import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import {
  formatData,
  hoje,
  proximaRotina,
  ROTINAS_SUGERIDAS,
  situacao,
  uid,
  useColecao,
  type Rotina,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/rotinas")({
  component: Rotinas,
});

const FREQUENCIAS: Record<string, number> = {
  Diária: 1,
  Semanal: 7,
  Quinzenal: 15,
  Mensal: 30,
  Trimestral: 90,
  Anual: 365,
};
const nomeFrequencia = (dias: number) =>
  Object.entries(FREQUENCIAS).find(([, d]) => d === dias)?.[0] ?? `A cada ${dias} dias`;

function Rotinas() {
  const [rotinas, salvar] = useColecao<Rotina>("rotinas");
  const [form, setForm] = useState({ titulo: "", frequencia: "Diária", responsavel: "" });

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    salvar((l) => [
      ...l,
      {
        id: uid(),
        titulo: form.titulo.trim(),
        frequencia_dias: FREQUENCIAS[form.frequencia] ?? 1,
        responsavel: form.responsavel,
        ultima_execucao: null,
      },
    ]);
    setForm({ ...form, titulo: "" });
  }

  function sugeridas() {
    const existentes = new Set(rotinas.map((r) => r.titulo));
    const novas = ROTINAS_SUGERIDAS.filter((r) => !existentes.has(r.titulo)).map((r) => ({
      ...r,
      id: uid(),
    }));
    salvar((l) => [...l, ...novas]);
    toast.success(`${novas.length} rotina(s) adicionada(s)`);
  }

  const concluir = (id: string) => {
    salvar((l) => l.map((r) => (r.id === id ? { ...r, ultima_execucao: hoje() } : r)));
    toast.success("Rotina marcada como feita hoje");
  };

  const ordenadas = [...rotinas].sort((a, b) =>
    (proximaRotina(a) ?? "").localeCompare(proximaRotina(b) ?? ""),
  );

  return (
    <div className="space-y-8">
      <Painel
        titulo="Nova rotina"
        acao={
          <Button variant="outline" className="rounded-full" onClick={sugeridas}>
            Adicionar rotinas sugeridas
          </Button>
        }
      >
        <form onSubmit={adicionar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Rotina" className="lg:col-span-2">
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
            />
          </Campo>
          <Campo label="Frequência">
            <Seletor
              opcoes={Object.keys(FREQUENCIAS)}
              value={form.frequencia}
              onChange={(e) => setForm({ ...form, frequencia: e.target.value })}
            />
          </Campo>
          <Campo label="Responsável">
            <Input
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </Campo>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" className="rounded-full">
              Adicionar
            </Button>
          </div>
        </form>
      </Painel>

      <Painel titulo="Rotinas administrativas">
        {ordenadas.length === 0 ? (
          <Vazio>Nenhuma rotina cadastrada.</Vazio>
        ) : (
          <div className="divide-y">
            {ordenadas.map((r) => {
              const prox = proximaRotina(r);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{r.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {nomeFrequencia(r.frequencia_dias)} · {r.responsavel || "sem responsável"} ·
                      última: {formatData(r.ultima_execucao)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SituacaoBadge
                      situacao={prox ? situacao(prox, 0) : "vencido"}
                      vencimento={prox}
                    />
                    <Button size="sm" className="rounded-full" onClick={() => concluir(r.id)}>
                      Feito hoje
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        confirm("Excluir esta rotina?") &&
                        salvar((l) => l.filter((x) => x.id !== r.id))
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Painel>
    </div>
  );
}
