import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import { addDias, formatData, hoje, useUnidadeAtual } from "@/lib/gestao";
import { useDrenagens, useGravarManutencao } from "@/lib/manutencao-dados";
import {
  contarPendentes,
  formatarLitros,
  PERIODO_DRENAGEM_DIAS,
  PRODUTOS_DIESEL,
  resumoPorTanque,
  type Drenagem,
} from "@/lib/manutencao-regras";
import { abrirRelatorio, relatorioDrenagemHtml } from "@/lib/manutencao-relatorios";

const POR_PAGINA = 50;

const vazio = () => ({
  data: hoje(),
  tanque: "",
  produto: PRODUTOS_DIESEL[0] as string,
  capacidade: "",
  amostra: "",
  agua: "",
  aguaMedidor: "Não",
  temAgua: "Não",
  aspecto: "Sim",
  cor: "",
  medida: "",
  responsavel: "",
  rg: "",
});

/** Número digitado ("1.500,5" ou "1500.5") ou null se estiver vazio. */
function numero(t: string): number | null | undefined {
  if (!t.trim()) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function DrenagemTanque() {
  const { unidade } = useUnidadeAtual();
  const { data: drenagens = [], isLoading, error } = useDrenagens(unidade?.id);
  const { lancarDrenagem, excluirDrenagem } = useGravarManutencao(unidade?.id);
  const [form, setForm] = useState(vazio);
  const [gravando, setGravando] = useState(false);
  const [de, setDe] = useState(() => addDias(hoje(), -90));
  const [ate, setAte] = useState(hoje);
  const [tanque, setTanque] = useState("Todos");
  const [limite, setLimite] = useState(POR_PAGINA);

  const tanques = useMemo(() => resumoPorTanque(drenagens), [drenagens]);
  const noPeriodo = useMemo(
    () =>
      drenagens.filter(
        (d) => d.data >= de && d.data <= ate && (tanque === "Todos" || d.tanque === tanque),
      ),
    [drenagens, de, ate, tanque],
  );
  const comAgua = noPeriodo.filter((d) => d.tem_agua).length;
  const pendentes = contarPendentes(tanques.map((t) => t.situacao));

  const set =
    (k: keyof ReturnType<typeof vazio>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const capacidade = numero(form.capacidade);
    const amostra = numero(form.amostra);
    const agua = numero(form.agua);
    if (!form.tanque.trim()) return void toast.error("Informe o número do tanque.");
    if ([capacidade, amostra, agua].includes(undefined))
      return void toast.error("Volumes e capacidade devem ser números, como 1.500 ou 2,5.");
    setGravando(true);
    try {
      await lancarDrenagem({
        data: form.data,
        tanque: form.tanque.trim(),
        produto: form.produto,
        capacidade_litros: capacidade == null ? null : Math.round(capacidade),
        volume_amostra_litros: amostra ?? null,
        volume_agua_litros: agua ?? null,
        tem_agua: form.temAgua === "Sim",
        aspecto_normal: form.aspecto === "Sim",
        agua_no_medidor: form.aguaMedidor === "Sim",
        cor: form.cor.trim() || null,
        medida_adotada: form.medida.trim() || null,
        responsavel: form.responsavel.trim() || null,
        rg_responsavel: form.rg.trim() || null,
      });
      toast.success("Drenagem registrada");
      setForm({
        ...vazio(),
        tanque: form.tanque,
        produto: form.produto,
        responsavel: form.responsavel,
        rg: form.rg,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gravar a drenagem.");
    } finally {
      setGravando(false);
    }
  }

  // Chamado direto do clique: o navegador só deixa abrir a janela do relatório assim.
  function relatorio(d: Drenagem) {
    const html = relatorioDrenagemHtml(d, unidade?.nome ?? "");
    if (!abrirRelatorio(html))
      toast.error("O navegador bloqueou a janela. Libere pop-ups para este site.");
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lançamento de drenagem?")) return;
    try {
      await excluirDrenagem(id);
      toast.success("Lançamento excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          rotulo="Drenagens no período"
          valor={noPeriodo.length}
          className="bg-ink text-cream"
        />
        <Cartao
          rotulo="Com água"
          valor={comAgua}
          detalhe="no período"
          className={comAgua > 0 ? "bg-destructive text-destructive-foreground" : "bg-card"}
        />
        <Cartao rotulo="Tanques" valor={tanques.length} detalhe="com lançamento" />
        <Cartao
          rotulo="Pedem atenção"
          valor={pendentes}
          detalhe={`drenagem a cada ${PERIODO_DRENAGEM_DIAS} dias`}
          className={pendentes > 0 ? "bg-amber-400 text-black" : "bg-card"}
        />
      </div>

      <Painel titulo="Tanques">
        {tanques.length === 0 ? (
          <Vazio>Nenhuma drenagem registrada neste posto.</Vazio>
        ) : (
          <div className="divide-y">
            {tanques.map((t) => (
              <div
                key={t.tanque}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold">
                    Tanque {t.tanque} · {t.produto}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Última drenagem {formatData(t.ultima)} · {t.total} lançamento
                    {t.total === 1 ? "" : "s"}
                    {t.comAgua > 0 && ` · ${t.comAgua} com água`}
                  </p>
                </div>
                <SituacaoBadge situacao={t.situacao} vencimento={t.proxima} />
              </div>
            ))}
          </div>
        )}
      </Painel>

      <Painel titulo="Nova drenagem">
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Data da coleta">
            <Input type="date" value={form.data} max={hoje()} onChange={set("data")} required />
          </Campo>
          <Campo label="Tanque (número)">
            <Input
              list="tanques-conhecidos"
              value={form.tanque}
              onChange={set("tanque")}
              required
            />
            <datalist id="tanques-conhecidos">
              {tanques.map((t) => (
                <option key={t.tanque} value={t.tanque} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Produto">
            <Seletor opcoes={PRODUTOS_DIESEL} value={form.produto} onChange={set("produto")} />
          </Campo>
          <Campo label="Capacidade do tanque (L)">
            <Input inputMode="decimal" value={form.capacidade} onChange={set("capacidade")} />
          </Campo>
          <Campo label="Volume drenado (L)">
            <Input inputMode="decimal" value={form.amostra} onChange={set("amostra")} />
          </Campo>
          <Campo label="Presença de água?">
            <Seletor opcoes={["Não", "Sim"]} value={form.temAgua} onChange={set("temAgua")} />
          </Campo>
          <Campo label="Volume de água drenado (L)">
            <Input inputMode="decimal" value={form.agua} onChange={set("agua")} />
          </Campo>
          <Campo label="Água no medidor (mm)?">
            <Seletor
              opcoes={["Não", "Sim"]}
              value={form.aguaMedidor}
              onChange={set("aguaMedidor")}
            />
          </Campo>
          <Campo
            label="Homogêneo, límpido e isento de material particulado?"
            className="sm:col-span-2"
          >
            <Seletor opcoes={["Sim", "Não"]} value={form.aspecto} onChange={set("aspecto")} />
          </Campo>
          <Campo label="Cor">
            <Input value={form.cor} onChange={set("cor")} />
          </Campo>
          <Campo label="Medida adotada" className="sm:col-span-2">
            <Input value={form.medida} onChange={set("medida")} />
          </Campo>
          <Campo label="Responsável">
            <Input value={form.responsavel} onChange={set("responsavel")} />
          </Campo>
          <Campo label="RG do responsável">
            <Input value={form.rg} onChange={set("rg")} />
          </Campo>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <Button type="submit" className="rounded-full" disabled={gravando}>
              {gravando ? "Gravando…" : "Registrar drenagem"}
            </Button>
          </div>
        </form>
      </Painel>

      <Painel
        titulo="Lançamentos"
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => setDe(e.target.value)}
              className="w-40"
              aria-label="De"
            />
            <Input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              className="w-40"
              aria-label="Até"
            />
            <Seletor
              opcoes={["Todos", ...tanques.map((t) => t.tanque)]}
              value={tanque}
              onChange={(e) => setTanque(e.target.value)}
              className="w-36"
              aria-label="Tanque"
            />
          </div>
        }
      >
        {error ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar as drenagens:{" "}
            {error instanceof Error ? error.message : "erro"}
          </p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : noPeriodo.length === 0 ? (
          <Vazio>Nenhuma drenagem no período.</Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {[
                      "Data",
                      "Tanque",
                      "Produto",
                      "Volume drenado",
                      "Água",
                      "Medidor",
                      "Límpido",
                      "Cor",
                      "Medida adotada",
                      "Responsável",
                      "",
                    ].map((c) => (
                      <th key={c} className="py-2 pr-3 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {noPeriodo.slice(0, limite).map((d) => (
                    <tr key={d.id} className="align-top">
                      <td className="whitespace-nowrap py-2 pr-3 font-semibold">
                        {formatData(d.data)}
                      </td>
                      <td className="py-2 pr-3">{d.tanque}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{d.produto}</td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {formatarLitros(d.volume_amostra_litros)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {d.tem_agua ? (
                          <span className="font-semibold text-destructive">
                            {formatarLitros(d.volume_agua_litros)}
                          </span>
                        ) : (
                          "Sem água"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {d.agua_no_medidor == null ? (
                          "—"
                        ) : d.agua_no_medidor ? (
                          <span className="font-semibold text-destructive">Sim</span>
                        ) : (
                          "Não"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {d.aspecto_normal == null ? (
                          "—"
                        ) : d.aspecto_normal ? (
                          "Sim"
                        ) : (
                          <span className="font-semibold text-destructive">Não</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{d.cor || "—"}</td>
                      <td className="min-w-48 py-2 pr-3">{d.medida_adotada || "—"}</td>
                      <td className="py-2 pr-3">
                        {d.responsavel || "—"}
                        {d.rg_responsavel && (
                          <span className="block text-xs text-muted-foreground">
                            RG {d.rg_responsavel}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => relatorio(d)}>
                          Relatório
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => excluir(d.id)}>
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {noPeriodo.length > limite && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setLimite(limite + POR_PAGINA)}
                >
                  Mostrar mais ({noPeriodo.length - limite})
                </Button>
              </div>
            )}
          </>
        )}
      </Painel>
    </div>
  );
}
