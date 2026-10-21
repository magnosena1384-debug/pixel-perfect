import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDias, formatData, hoje } from "@/lib/gestao";
import { ENDPOINTS, importarWebPosto, listarEmpresasWebPosto } from "@/lib/webposto";

export const Route = createFileRoute("/_authenticated/admin/webposto")({
  component: WebPosto,
});

function WebPosto() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-card p-6">
        <h2 className="text-2xl font-bold uppercase">Integração webPosto</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Importa vendas, operação e financeiro do webPosto (Quality Automação). Cada posto tem a
          sua chave, gerada no webPosto em Administração → Integrações (depois que a Quality libera
          o contrato "API Integração"). Cadastre todas na Vercel numa variável de ambiente{" "}
          <code className="rounded bg-muted px-1">WEBPOSTO_CHAVES</code>, separadas por vírgula.
        </p>
      </div>
      <Empresas />
      <Importar />
      <Registros />
    </div>
  );
}

function Empresas() {
  const qc = useQueryClient();
  const listar = useServerFn(listarEmpresasWebPosto);
  const [empresas, setEmpresas] = useState<{ codigo: number; nome: string }[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const { data: unidades = [] } = useQuery({
    queryKey: ["webposto", "unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, ordem, webposto_empresa")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  async function buscar() {
    setBuscando(true);
    try {
      setEmpresas(await listar());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o webPosto.");
    } finally {
      setBuscando(false);
    }
  }

  async function salvar(id: string, valor: string) {
    const codigo = valor.trim() ? Number(valor) : null;
    if (codigo != null && !Number.isInteger(codigo)) return void toast.error("Código inválido.");
    const { error } = await supabase
      .from("unidades")
      .update({ webposto_empresa: codigo })
      .eq("id", id);
    if (error)
      return void toast.error(
        error.code === "23505" ? "Esse código já está em outra unidade." : error.message,
      );
    toast.success("Código salvo");
    void qc.invalidateQueries({ queryKey: ["webposto"] });
  }

  return (
    <div className="rounded-3xl bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold uppercase">Unidades no webPosto</h3>
          <p className="text-sm text-muted-foreground">
            Informe o código da empresa (filial) de cada unidade no webPosto. Os registros
            importados são ligados à unidade por esse código.
          </p>
        </div>
        <Button variant="outline" className="rounded-full" disabled={buscando} onClick={buscar}>
          {buscando ? "Consultando…" : "Buscar empresas no webPosto"}
        </Button>
      </div>
      {empresas && (
        <div className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          <p className="mb-2 font-semibold">Empresas encontradas no webPosto</p>
          {empresas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma empresa retornada.</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {empresas.map((e) => (
                <li key={`${e.codigo}-${e.nome}`}>
                  <span className="font-mono font-semibold">{e.codigo}</span> · {e.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {unidades.map((u) => (
          <li key={u.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium">{u.nome}</span>
            <CodigoEmpresa valor={u.webposto_empresa} onSalvar={(v) => salvar(u.id, v)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodigoEmpresa({
  valor,
  onSalvar,
}: {
  valor: number | null;
  onSalvar: (v: string) => void;
}) {
  const [v, setV] = useState(valor?.toString() ?? "");
  useEffect(() => setV(valor?.toString() ?? ""), [valor]);
  return (
    <Input
      className="w-28"
      inputMode="numeric"
      placeholder="Código"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (valor?.toString() ?? "") && onSalvar(v)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function Importar() {
  const qc = useQueryClient();
  const importar = useServerFn(importarWebPosto);
  const [inicio, setInicio] = useState(addDias(hoje(), -1));
  const [fim, setFim] = useState(hoje());
  const [escolhidos, setEscolhidos] = useState<string[]>(["VENDAS", "FUNCIONARIOS"]);
  const [outro, setOutro] = useState("");
  const [rodando, setRodando] = useState<string | null>(null);

  const { data: historico = [] } = useQuery({
    queryKey: ["webposto", "importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webposto_importacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function executar() {
    const lista = [
      ...escolhidos,
      ...outro
        .toUpperCase()
        .split(/[\s,;]+/)
        .filter(Boolean),
    ];
    if (!lista.length) return void toast.error("Escolha ao menos um tipo de dado.");
    for (const endpoint of lista) {
      setRodando(endpoint);
      try {
        const r = await importar({ data: { endpoint, dataInicial: inicio, dataFinal: fim } });
        toast.success(
          `${endpoint}: ${r.quantidade} registro(s)` +
            (r.semUnidade ? ` · ${r.semUnidade} sem unidade (confira os códigos)` : ""),
        );
      } catch (e) {
        toast.error(`${endpoint}: ${e instanceof Error ? e.message : "falhou"}`);
      }
    }
    setRodando(null);
    void qc.invalidateQueries({ queryKey: ["webposto"] });
  }

  const areas = [...new Set(ENDPOINTS.map((e) => e.area))];
  return (
    <div className="rounded-3xl bg-card p-6">
      <h3 className="text-xl font-bold uppercase">Importar</h3>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wp-inicio">De</Label>
          <Input
            id="wp-inicio"
            type="date"
            value={inicio}
            max={fim}
            onChange={(e) => setInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wp-fim">Até</Label>
          <Input
            id="wp-fim"
            type="date"
            value={fim}
            min={inicio}
            onChange={(e) => setFim(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {areas.map((area) => (
          <div key={area}>
            <p className="eyebrow mb-2 text-forest">{area}</p>
            <ul className="space-y-2">
              {ENDPOINTS.filter((e) => e.area === area).map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={escolhidos.includes(e.id)}
                      onCheckedChange={(v) =>
                        setEscolhidos((l) => (v ? [...l, e.id] : l.filter((x) => x !== e.id)))
                      }
                    />
                    {e.label}
                    <code className="text-xs text-muted-foreground">{e.id}</code>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 max-w-md space-y-1.5">
        <Label htmlFor="wp-outro">Outros endpoints (opcional)</Label>
        <Input
          id="wp-outro"
          placeholder="Ex.: PRODUTOS, CLIENTES (nome do Swagger, sem /V1)"
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
        />
      </div>
      <Button className="mt-5 rounded-full" disabled={!!rodando} onClick={executar}>
        {rodando ? `Importando ${rodando}…` : "Importar agora"}
      </Button>

      {historico.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <p className="eyebrow mb-2 text-muted-foreground">Últimas importações</p>
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {historico.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(h.criado_em).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3 font-mono">{h.endpoint}</td>
                  <td className="py-2 pr-3">
                    {formatData(h.data_inicial)} a {formatData(h.data_final)}
                  </td>
                  <td className="py-2 pr-3">
                    {h.quantidade} registro(s)
                    {h.sem_unidade > 0 && (
                      <span className="text-amber-700"> · {h.sem_unidade} sem unidade</span>
                    )}
                  </td>
                  <td className="py-2 text-destructive">{h.erro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Registros() {
  const [endpoint, setEndpoint] = useState("");
  const [unidade, setUnidade] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: resumo = [] } = useQuery({
    queryKey: ["webposto", "resumo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webposto_registros")
        .select("endpoint")
        .limit(10000);
      if (error) throw error;
      const contagem = new Map<string, number>();
      for (const r of data) contagem.set(r.endpoint, (contagem.get(r.endpoint) ?? 0) + 1);
      return [...contagem.entries()].sort();
    },
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ["webposto", "unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, ordem, webposto_empresa")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });
  const atual = endpoint || resumo[0]?.[0] || "";
  const { data: registros = [] } = useQuery({
    queryKey: ["webposto", "registros", atual, unidade],
    enabled: !!atual,
    queryFn: async () => {
      let q = supabase
        .from("webposto_registros")
        .select("codigo, data_ref, empresa_codigo, unidade_id, dados")
        .eq("endpoint", atual)
        .order("data_ref", { ascending: false })
        .limit(50);
      if (unidade) q = q.eq("unidade_id", unidade);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const colunas = [
    ...new Set(registros.flatMap((r) => Object.keys((r.dados ?? {}) as object)).slice(0, 8)),
  ];
  const nomeUnidade = (id: string | null) => unidades.find((u) => u.id === id)?.nome ?? "—";
  const celula = (v: unknown) =>
    v == null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v);

  return (
    <div className="rounded-3xl bg-card p-6">
      <h3 className="text-xl font-bold uppercase">Dados importados</h3>
      {resumo.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum registro importado ainda.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {resumo.map(([e, n]) => (
              <button
                key={e}
                type="button"
                onClick={() => setEndpoint(e)}
                className={`rounded-full border px-4 py-1.5 text-sm ${e === atual ? "border-ink bg-ink text-cream" : "hover:bg-muted"}`}
              >
                <span className="font-mono">{e}</span> · {n.toLocaleString("pt-BR")}
              </button>
            ))}
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="h-9 rounded-full border bg-background px-3 text-sm"
              aria-label="Filtrar por unidade"
            >
              <option value="">Todas as unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Últimos 50 registros. As colunas são os campos que o webPosto enviou; com elas definimos
            os relatórios.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3">Unidade</th>
                  {colunas.map((c) => (
                    <th key={c} className="py-2 pr-3 font-mono">
                      {c}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <Fragment key={r.codigo}>
                    <tr className="border-t">
                      <td className="py-2 pr-3">{nomeUnidade(r.unidade_id)}</td>
                      {colunas.map((c) => (
                        <td key={c} className="py-2 pr-3">
                          {celula((r.dados as Record<string, unknown>)?.[c])}
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setAberto(aberto === r.codigo ? null : r.codigo)}
                        >
                          {aberto === r.codigo ? "fechar" : "ver tudo"}
                        </button>
                      </td>
                    </tr>
                    {aberto === r.codigo && (
                      <tr key={`${r.codigo}-json`}>
                        <td colSpan={colunas.length + 2}>
                          <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3">
                            {JSON.stringify(r.dados, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
