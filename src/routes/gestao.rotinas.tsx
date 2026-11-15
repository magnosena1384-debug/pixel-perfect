import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoEvidencias, GaleriaEvidencias } from "@/components/gestao/Evidencias";
import { Campo, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import { apagarEvidencias, enviarEvidencias } from "@/lib/evidencias";
import { caminhosDeEvidencias, registrarExecucao } from "@/lib/evidencias-regras";
import {
  formatData,
  hoje,
  proximaRotina,
  ROTINAS_SUGERIDAS,
  situacao,
  uid,
  useColecao,
  useUnidadeAtual,
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
  const [editando, setEditando] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const [historico, setHistorico] = useState<string | null>(null);

  function atualizar(r: Rotina) {
    salvar((l) => l.map((x) => (x.id === r.id ? r : x)));
    setEditando(null);
    toast.success("Rotina atualizada");
  }

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

  async function executada(r: Rotina) {
    await salvar((l) => l.map((x) => (x.id === r.id ? r : x)));
    setConcluindo(null);
    toast.success("Execução registrada");
  }

  function excluir(r: Rotina) {
    if (!confirm("Excluir esta rotina e as fotos das execuções?")) return;
    void salvar((l) => l.filter((x) => x.id !== r.id));
    void apagarEvidencias(caminhosDeEvidencias(...(r.execucoes ?? []).map((e) => e.evidencias)));
  }

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
                <div key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => setConcluindo(concluindo === r.id ? null : r.id)}
                      >
                        Feito hoje
                      </Button>
                      {(r.execucoes?.length ?? 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistorico(historico === r.id ? null : r.id)}
                        >
                          Histórico ({r.execucoes!.length})
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditando(editando === r.id ? null : r.id)}
                      >
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => excluir(r)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                  <GaleriaEvidencias evidencias={r.execucoes?.[0]?.evidencias} />
                  {concluindo === r.id && (
                    <FormExecucao
                      rotina={r}
                      onSalvar={executada}
                      onCancelar={() => setConcluindo(null)}
                    />
                  )}
                  {historico === r.id && (
                    <ul className="mt-3 space-y-3 rounded-2xl bg-muted p-4 text-sm">
                      {r.execucoes!.map((e, i) => (
                        <li key={`${e.data}-${i}`}>
                          <span className="font-semibold">{formatData(e.data)}</span>
                          {e.obs && ` · ${e.obs}`}
                          <GaleriaEvidencias evidencias={e.evidencias} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {editando === r.id && (
                    <EditarRotina
                      rotina={r}
                      onSalvar={atualizar}
                      onCancelar={() => setEditando(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Painel>
    </div>
  );
}

/** "Feito hoje": data, observação e fotos de evidência (câmera ou galeria). */
function FormExecucao({
  rotina,
  onSalvar,
  onCancelar,
}: {
  rotina: Rotina;
  onSalvar: (r: Rotina) => Promise<void>;
  onCancelar: () => void;
}) {
  const { unidade } = useUnidadeAtual();
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [gravando, setGravando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!unidade) return;
    setGravando(true);
    try {
      const evidencias = fotos.length ? await enviarEvidencias(fotos, unidade.id, "rotinas") : [];
      await onSalvar(registrarExecucao(rotina, { data, obs: obs.trim(), evidencias }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a execução.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-3">
      <Campo label="Data da execução">
        <Input
          type="date"
          value={data}
          max={hoje()}
          onChange={(e) => setData(e.target.value)}
          required
        />
      </Campo>
      <Campo label="Observação" className="sm:col-span-2">
        <Input value={obs} onChange={(e) => setObs(e.target.value)} />
      </Campo>
      <Campo label="Evidências (fotos)" className="sm:col-span-3">
        <CampoEvidencias fotos={fotos} onChange={setFotos} desabilitado={gravando} />
      </Campo>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" className="rounded-full" disabled={gravando}>
          {gravando ? "Gravando…" : "Registrar execução"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar} disabled={gravando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function EditarRotina({
  rotina,
  onSalvar,
  onCancelar,
}: {
  rotina: Rotina;
  onSalvar: (r: Rotina) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({
    titulo: rotina.titulo,
    dias: String(rotina.frequencia_dias),
    responsavel: rotina.responsavel,
    ultima: rotina.ultima_execucao ?? "",
  });
  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const dias = Number(f.dias);
    if (!f.titulo.trim()) return void toast.error("Informe o nome da rotina.");
    if (!Number.isInteger(dias) || dias < 1) return void toast.error("Frequência inválida.");
    onSalvar({
      ...rotina,
      titulo: f.titulo.trim(),
      frequencia_dias: dias,
      responsavel: f.responsavel,
      ultima_execucao: f.ultima || null,
    });
  }
  return (
    <form
      onSubmit={enviar}
      className="mt-3 grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <Campo label="Rotina" className="lg:col-span-2">
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required />
      </Campo>
      <Campo label="A cada quantos dias">
        <Input
          type="number"
          min={1}
          list="frequencias"
          value={f.dias}
          onChange={(e) => setF({ ...f, dias: e.target.value })}
        />
        <datalist id="frequencias">
          {Object.entries(FREQUENCIAS).map(([nome, d]) => (
            <option key={nome} value={d}>
              {nome}
            </option>
          ))}
        </datalist>
      </Campo>
      <Campo label="Responsável">
        <Input
          value={f.responsavel}
          onChange={(e) => setF({ ...f, responsavel: e.target.value })}
        />
      </Campo>
      <Campo label="Última execução">
        <Input
          type="date"
          max={hoje()}
          value={f.ultima}
          onChange={(e) => setF({ ...f, ultima: e.target.value })}
        />
      </Campo>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="submit" size="sm" className="rounded-full">
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
