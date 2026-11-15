import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import { formatData, hoje, useUnidadeAtual } from "@/lib/gestao";
import { useAfericoes, useGravarManutencao } from "@/lib/manutencao-dados";
import {
  agruparAfericoes,
  contarPendentes,
  formatarVazao,
  horaDaAfericao,
  PERIODO_AFERICAO_DIAS,
  resultadoAfericao,
  TOLERANCIA_VAZAO_ML,
  type Afericao,
} from "@/lib/manutencao-regras";
import { abrirRelatorio, relatorioAfericaoHtml } from "@/lib/manutencao-relatorios";

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
  hora: horaAgora(),
  produto: PRODUTOS[0] as string,
  vazaoAlta: "",
  vazaoBaixa: "",
  responsavel: "",
  obs: "",
});

/** "HH:MM" agora, no horário de Brasília. */
function horaAgora() {
  return new Date().toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor em ml (inteiro, pode ser negativo): null se vazio, undefined se inválido. */
function mililitros(t: string): number | null | undefined {
  const limpo = t.trim().replace("−", "-").replace("+", "");
  if (!limpo) return null;
  return /^-?d+$/.test(limpo) ? Number(limpo) : undefined;
}

/** "· alta -20 ml · baixa -40 ml · Aprovado"; nada se não houver vazão lida. */
function ResultadoVazao({ a }: { a: Afericao }) {
  const r = resultadoAfericao(a.vazao_alta_ml, a.vazao_baixa_ml);
  if (r === "sem-resultado") return null;
  return (
    <>
      {" · "}alta {formatarVazao(a.vazao_alta_ml)} · baixa {formatarVazao(a.vazao_baixa_ml)} ·{" "}
      <span className={r === "aprovado" ? "font-semibold" : "font-semibold text-destructive"}>
        {r === "aprovado" ? "Aprovado" : "Reprovado"}
      </span>
    </>
  );
}

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
    const alta = mililitros(form.vazaoAlta);
    const baixa = mililitros(form.vazaoBaixa);
    if (alta === undefined || baixa === undefined)
      return void toast.error("A vazão é um número em ml, como -20 ou 40.");
    setGravando(true);
    try {
      await lancarAfericao({
        data: form.data,
        // Horário de Brasília (sem horário de verão).
        realizada_em: new Date(`${form.data}T${form.hora || "00:00"}:00-03:00`).toISOString(),
        bomba: form.bomba.trim(),
        bico: form.bico.trim(),
        produto: form.produto,
        vazao_alta_ml: alta,
        vazao_baixa_ml: baixa,
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

  // Chamado direto do clique: o navegador só deixa abrir a janela do relatório assim.
  function relatorio(a: Afericao) {
    const html = relatorioAfericaoHtml(a, unidade?.nome ?? "");
    if (!abrirRelatorio(html))
      toast.error("O navegador bloqueou a janela. Libere pop-ups para este site.");
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
          <Campo label="Hora da aferição">
            <Input type="time" value={form.hora} onChange={set("hora")} required />
          </Campo>
          <Campo label={`Vazão alta (ml, tolerância ± ${TOLERANCIA_VAZAO_ML})`}>
            <Input inputMode="numeric" value={form.vazaoAlta} onChange={set("vazaoAlta")} />
          </Campo>
          <Campo label={`Vazão baixa (ml, tolerância ± ${TOLERANCIA_VAZAO_ML})`}>
            <Input inputMode="numeric" value={form.vazaoBaixa} onChange={set("vazaoBaixa")} />
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
                          {h.realizada_em && ` ${horaDaAfericao(h.realizada_em)}`}
                          <ResultadoVazao a={h} />
                          {h.responsavel && ` · ${h.responsavel}`}
                          {h.obs && ` · ${h.obs}`}
                          {h.origem_id && (
                            <span className="text-muted-foreground">
                              {" "}
                              · importada do Posto Seguro
                            </span>
                          )}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => relatorio(h)}>
                          Relatório
                        </Button>
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
