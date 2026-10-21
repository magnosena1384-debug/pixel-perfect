// Importação automática do webPosto, chamada de hora em hora pelo pg_cron (migração 0018).
// Busca FUNCIONARIOS, VENDAS e VENDAS_ITENS de ontem e hoje (ou do período {dataInicial, dataFinal} do corpo) em cada posto, com as chaves do Vault, e grava em
// webposto_registros do mesmo jeito que a importação manual (src/lib/webposto.ts).
// Só aceita quem manda o segredo do agendador (Vault: webposto_cron_segredo).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BASE = "https://web.qualityautomacao.com.br/INTEGRACAO/V1";
const LIMITE = 2000;
const MAX_PAGINAS = 50;
const ENDPOINTS = ["FUNCIONARIOS", "VENDAS", "VENDAS_ITENS"];

type Registro = Record<string, unknown>;

function extrairLista(corpo: unknown): Registro[] {
  if (Array.isArray(corpo)) return corpo as Registro[];
  if (corpo && typeof corpo === "object") {
    for (const v of Object.values(corpo)) if (Array.isArray(v)) return v as Registro[];
  }
  return [];
}

function chaveRegistro(r: Registro, endpoint: string): string {
  if (r["codigo"] != null) return String(r["codigo"]);
  const proprio = endpoint.toLowerCase().replace(/_/g, "") + "codigo";
  for (const [k, v] of Object.entries(r))
    if (k.toLowerCase() === proprio && v != null) return String(v);
  for (const [k, v] of Object.entries(r)) {
    const kl = k.toLowerCase();
    if (kl.endsWith("codigo") && kl !== "empresacodigo" && v != null && typeof v !== "object")
      return String(v);
  }
  return JSON.stringify(r);
}

function dataRegistro(r: Registro): string | null {
  for (const [k, v] of Object.entries(r)) {
    if (k.toLowerCase().startsWith("data") && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
      return v.slice(0, 10);
  }
  return null;
}

function empresaRegistro(r: Registro): number | null {
  for (const [k, v] of Object.entries(r)) {
    if (k.toLowerCase() === "empresacodigo" && v != null && Number.isFinite(Number(v)))
      return Number(v);
  }
  return null;
}

/** Item de venda reduzido ao que o painel usa (igual a itemCompacto em src/lib/webposto.ts). */
function itemCompacto(r: Registro, unidadeId: string | null) {
  const empresa = Number(r["empresaCodigo"]);
  const item = Number(r["vendaItemCodigo"] ?? r["codigo"]);
  const venda = Number(r["vendaCodigo"]);
  const data = typeof r["dataMovimento"] === "string" ? r["dataMovimento"].slice(0, 10) : null;
  if (![empresa, item, venda].every(Number.isFinite) || !data) return null;
  const descricao = String(r["produtoDescricao"] ?? "").trim();
  return {
    empresa_codigo: empresa,
    item_codigo: item,
    venda_codigo: venda,
    unidade_id: unidadeId,
    data_ref: data,
    produto: descricao || `Produto ${r["produtoCodigo"] ?? "?"}`,
    bico: r["bicoCodigo"] != null,
    quantidade: Number(r["quantidade"]) || 0,
    total: Number(r["totalVenda"]) || 0,
    importado_em: new Date().toISOString(),
  };
}

function proximoCodigo(corpo: unknown, lista: Registro[], endpoint: string, atual: number) {
  if (corpo && typeof corpo === "object" && !Array.isArray(corpo)) {
    const v = (corpo as Record<string, unknown>)["ultimoCodigo"];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  const numeros = lista.map((r) => Number(chaveRegistro(r, endpoint))).filter(Number.isFinite);
  return numeros.length ? Math.max(atual, ...numeros) : atual;
}

async function chamar(chave: string, endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`${BASE}/${endpoint === "VENDAS_ITENS" ? "VENDAS/ITENS" : endpoint}`);
  url.searchParams.set("chave", chave);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Key ${chave}`, Accept: "application/json" },
  });
  const texto = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error("o webPosto recusou a chave");
  if (!res.ok) throw new Error(`${endpoint} respondeu ${res.status}: ${texto.slice(0, 200)}`);
  if (!texto.trim()) return [];
  return JSON.parse(texto) as unknown;
}

/** Data AAAA-MM-DD no horário de Brasília, `dias` atrás. */
function diaBrasilia(dias: number): string {
  const d = new Date(Date.now() - dias * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: autorizado } = await supabase.rpc("webposto_cron_confere", {
    _segredo: req.headers.get("x-cron-segredo") ?? "",
  });
  if (!autorizado) return new Response("Não autorizado", { status: 401 });

  const { data: chaves, error: erroChaves } = await supabase.rpc("webposto_chaves");
  if (erroChaves) return new Response(erroChaves.message, { status: 500 });
  const { data: unidades } = await supabase.from("unidades").select("id, webposto_empresa");
  const porEmpresa = new Map(
    (unidades ?? [])
      .filter((u) => u.webposto_empresa != null)
      .map((u) => [u.webposto_empresa as number, u.id as string]),
  );

  const corpoPedido = await req.json().catch(() => ({}));
  const periodo = /^\d{4}-\d{2}-\d{2}$/;
  const dataInicial = periodo.test(corpoPedido?.dataInicial) ? corpoPedido.dataInicial : diaBrasilia(1);
  const dataFinal = periodo.test(corpoPedido?.dataFinal) ? corpoPedido.dataFinal : diaBrasilia(0);
  const so = Array.isArray(corpoPedido?.endpoints) ? (corpoPedido.endpoints as string[]) : null;
  const resumo: Record<string, unknown> = {};

  for (const endpoint of ENDPOINTS.filter((e) => !so || so.includes(e))) {
    let quantidade = 0;
    let semUnidade = 0;
    const erros: string[] = [];
    for (const [n, { chave }] of (chaves ?? []).entries()) {
      let ultimo = 0;
      try {
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
          const corpo = await chamar(chave, endpoint, {
            dataInicial,
            dataFinal,
            ultimoCodigo: ultimo,
            limite: LIMITE,
          });
          const lista = extrairLista(corpo);
          if (!lista.length) break;
          if (endpoint === "VENDAS_ITENS") {
            const itens = lista.flatMap((r) => {
              const empresa = empresaRegistro(r);
              const unidade = empresa != null ? (porEmpresa.get(empresa) ?? null) : null;
              if (!unidade) semUnidade++;
              const item = itemCompacto(r, unidade);
              return item ? [item] : [];
            });
            for (let i = 0; i < itens.length; i += 500) {
              const { error } = await supabase
                .from("webposto_vendas_itens")
                .upsert(itens.slice(i, i + 500));
              if (error) throw new Error(error.message);
            }
            quantidade += lista.length;
            const prox = proximoCodigo(corpo, lista, endpoint, ultimo);
            if (lista.length < LIMITE || prox === ultimo) break;
            ultimo = prox;
            continue;
          }
          const linhas = lista.map((r) => {
            const empresa = empresaRegistro(r);
            const unidade = empresa != null ? (porEmpresa.get(empresa) ?? null) : null;
            if (!unidade) semUnidade++;
            return {
              endpoint,
              codigo: `${empresa ?? `chave${n + 1}`}:${chaveRegistro(r, endpoint)}`,
              empresa_codigo: empresa,
              unidade_id: unidade,
              data_ref: dataRegistro(r),
              dados: r,
              importado_em: new Date().toISOString(),
            };
          });
          for (let i = 0; i < linhas.length; i += 500) {
            const { error } = await supabase
              .from("webposto_registros")
              .upsert(linhas.slice(i, i + 500));
            if (error) throw new Error(error.message);
          }
          quantidade += lista.length;
          const proximo = proximoCodigo(corpo, lista, endpoint, ultimo);
          if (lista.length < LIMITE || proximo === ultimo) break;
          ultimo = proximo;
        }
        // Cada chave enxerga todos os postos do grupo: a primeira que funciona basta.
        erros.length = 0;
        break;
      } catch (e) {
        erros.push(`Chave ${n + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Hora, vendedor e cancelamento vêm do cupom e são copiados para os itens (painel rápido).
    if (endpoint === "VENDAS" || endpoint === "VENDAS_ITENS") {
      const { error } = await supabase.rpc("webposto_consolidar_vendas", {
        _de: dataInicial,
        _ate: dataFinal,
      });
      if (error) erros.push(`Consolidar: ${error.message}`);
    }
    await supabase.from("webposto_importacoes").insert({
      endpoint,
      data_inicial: dataInicial,
      data_final: dataFinal,
      quantidade,
      sem_unidade: semUnidade,
      erro: erros.length ? `Automática: ${erros.join(" | ")}` : null,
    });
    resumo[endpoint] = { quantidade, semUnidade, erros };
  }

  return Response.json(resumo);
});
