import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import { formatData, hoje, useUnidadeAtual } from "@/lib/gestao";
import { useAfericoes, useGravarManutencao } from "@/lib/manutencao-dados";
import { agruparAfericoes, contarPendentes, PERIODO_AFERICAO_DIAS } from "@/lib/manutencao-regras";

const PRODUTOS = [
  "Gasolina Comum",
  "Gasolina Aditivada",
  "Etanol",
  "Diesel S-10",
  "Diesel S-500",
  "GNV",
] as const;

const vazio = () => ({
  data: hoje(),
  bomba: "",
  bico: "",
  produto: PRODUTOS[0] as string,
  responsavel: "",
  obs: "",
});

export function AfericaoBombas() {
  const { unidade } = useUnidadeAtual();
  const { data: afericoes = [], isLoading, error } = useAfericoes(unidade?.id);
  const { lancarAfericao, excluirAfericao } = useGravarManutencao(unidade?.id);
  const [form, setForm] = useState(vazio);
  const [gravando, setGravando] = useState(false);
  const [bomba, setBomba] = useState("Todas");
  const [aberto, setAberto] = useState<string | null>(null);

  const grupos = useMemo(() => agruparAfericoes(afericoes), [afericoes]);
  const bombas = useMemo(() => [...new Set(grupos.map((g) => g.bomba))], [grupos]);
  const visiveis = grupos.filter((g) => bomba === "Todas" || g.bomba === bomba);
  const pendentes = contarPendentes(grupos.map((g) => g.situacao));

  const set =
    (k: keyof ReturnType<typeof vazio>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bomba.trim() || !form.bico.trim()) {
      return void toast.error("Informe a bomba e o bico.");
    }
    setGravando(true);
    try {
      await lancarAfericao({
        data: form.data,
        bomba: form.bomba.trim(),
        bico: form.bico.trim(),
        produto: form.produto,
        responsavel: form.responsavel.trim() || null,
        obs: form.obs.trim() || null,
      });
      toast.success("Aferição registrada");
      setForm({ ...vazio(), responsavel: form.responsavel, bomba: form.bomba });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gravar a aferição.");
    } finally {
      setGravando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta aferição?")) return;
    try {
      await excluirAfericao(id);
      toast.success("Aferição excluída");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Bicos com aferição" valor={grupos.length} className="bg-ink text-cream" />
        <Cartao
          rotulo="Pedem atenção"
          valor={pendentes}
          detalhe={`aferição a cada ${PERIODO_AFERICAO_DIAS} dias`}
          className={pendentes > 0 ? "bg-amber-400 text-black" : "bg-card"}
        />
        <Cartao rotulo="Bombas" valor={bombas.length} />
        <Cartao rotulo="Aferições lançadas" valor={afericoes.length} />
      </div>

      <Painel titulo="Registrar aferição">
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Data">
            <Input type="date" value={form.data} max={hoje()} onChange={set("data")} required />
          </Campo>
          <Campo label="Bomba (número)">
            <Input list="bombas-conhecidas" value={form.bomba} onChange={set("bomba")} required />
            <datalist id="bombas-conhecidas">
              {bombas.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Bico">
            <Input value={form.bico} onChange={set("bico")} required />
          </Campo>
          <Campo label="Produto">
            <Seletor opcoes={PRODUTOS} value={form.produto} onChange={set("produto")} />
          </Campo>
          <Campo label="Responsável">
            <Input value={form.responsavel} onChange={set("responsavel")} />
          </Campo>
          <Campo label="Observação" className="sm:col-span-2">
            <Input value={form.obs} onChange={set("obs")} />
          </Campo>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-full" disabled={gravando}>
              {gravando ? "Gravando…" : "Registrar aferição"}
            </Button>
          </div>
        </form>
      </Painel>

      <Painel
        titulo="Bombas e bicos"
        acao={
          <Seletor
            opcoes={["Todas", ...bombas.map((b) => ({ valor: b, rotulo: `Bomba ${b}` }))]}
            value={bomba}
            onChange={(e) => setBomba(e.target.value)}
            className="w-44"
            aria-label="Bomba"
          />
        }
      >
        {error ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar as aferições:{" "}
            {error instanceof Error ? error.message : "erro"}
          </p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <Vazio>Nenhuma aferição registrada neste posto.</Vazio>
        ) : (
          <div className="divide-y">
            {visiveis.map((g) => (
              <div key={g.chave} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      Bomba {g.bomba} · Bico {g.bico} · {g.produto}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Última aferição {formatData(g.ultima)}
                      {g.responsavel && ` · ${g.responsavel}`} · próxima {formatData(g.proxima)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SituacaoBadge situacao={g.situacao} vencimento={g.proxima} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAberto(aberto === g.chave ? null : g.chave)}
                    >
                      Histórico ({g.historico.length})
                    </Button>
                  </div>
                </div>
                {aberto === g.chave && (
                  <ul className="mt-3 space-y-1 rounded-2xl bg-muted p-4 text-sm">
                    {g.historico.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-semibold">{formatData(h.data)}</span>
                          {h.responsavel && ` · ${h.responsavel}`}
                          {h.obs && ` · ${h.obs}`}
                          {h.origem_id && (
                            <span className="text-muted-foreground">
                              {" "}
                              · importada do Posto Seguro
                            </span>
                          )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => excluir(h.id)}>
                          Excluir
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Painel>
    </div>
  );
}
