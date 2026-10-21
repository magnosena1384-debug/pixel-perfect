import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

// API de integração do webPosto (Quality Automação). A chave é gerada no webPosto em
// Administração > Integrações. Ficam no Vault do Supabase (webposto_chave_<n>); cada uma enxerga
// todos os postos do grupo, e as outras servem de reserva.
// Caminhos conforme o Swagger público: web.qualityautomacao.com.br/v3/api-docs/integracao
const BASE = "https://web.qualityautomacao.com.br/INTEGRACAO/V1";
const LIMITE = 2000;
const MAX_PAGINAS = 200;

/** Endpoints sugeridos por área. VENDAS e FUNCIONARIOS alimentam o dashboard da gestão. */
export const ENDPOINTS = [
  { id: "VENDAS", area: "Vendas", label: "Vendas (cupons com itens)" },
  { id: "FUNCIONARIOS", area: "Vendas", label: "Funcionários (nomes no dashboard)" },
  { id: "ABASTECIMENTOS", area: "Operação", label: "Abastecimentos" },
  { id: "CAIXAS", area: "Operação", label: "Caixas / turnos" },
  { id: "TITULOS_RECEBER", area: "Financeiro", label: "Títulos a receber" },
  { id: "TITULOS_PAGAR", area: "Financeiro", label: "Títulos a pagar" },
] as const;

export type Registro = Record<string, unknown>;

/** A API pode devolver uma lista direta ou um objeto com a lista dentro (ex.: `resultados`). */
export function extrairLista(corpo: unknown): Registro[] {
  if (Array.isArray(corpo)) return corpo as Registro[];
  if (corpo && typeof corpo === "object") {
    for (const v of Object.values(corpo)) if (Array.isArray(v)) return v as Registro[];
  }
  return [];
}

/** Identificador do registro: `codigo`, ou o primeiro campo terminado em "codigo" que não seja de outra entidade. */
export function chaveRegistro(r: Registro, endpoint: string): string {
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

/** Código gravado no banco: o do registro precedido do posto (empresa), único entre os postos. */
export function codigoGravado(r: Registro, endpoint: string, posto: number | string): string {
  return `${posto}:${chaveRegistro(r, endpoint)}`;
}

/** Primeira data do registro (campo começando com "data"), no formato AAAA-MM-DD. */
export function dataRegistro(r: Registro): string | null {
  for (const [k, v] of Object.entries(r)) {
    if (k.toLowerCase().startsWith("data") && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
      return v.slice(0, 10);
  }
  return null;
}

export function empresaRegistro(r: Registro): number | null {
  for (const [k, v] of Object.entries(r)) {
    if (k.toLowerCase() === "empresacodigo" && v != null && Number.isFinite(Number(v)))
      return Number(v);
  }
  return null;
}

/** Próximo `ultimoCodigo`: o que a API informar, senão o maior código numérico recebido. */
export function proximoCodigo(corpo: unknown, lista: Registro[], endpoint: string, atual: number) {
  if (corpo && typeof corpo === "object" && !Array.isArray(corpo)) {
    const v = (corpo as Record<string, unknown>)["ultimoCodigo"];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  const numeros = lista.map((r) => Number(chaveRegistro(r, endpoint))).filter(Number.isFinite);
  return numeros.length ? Math.max(atual, ...numeros) : atual;
}

/** As chaves configuradas no servidor, sem repetidas. */
export function lerChaves(texto: string | undefined): string[] {
  return [
    ...new Set(
      (texto ?? "")
        .split(/[\s,;]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
}

/** Chaves do Vault do Supabase (webposto_chave_<n>); sem nenhuma lá, as do servidor. */
async function chaves(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase.rpc("webposto_chaves");
  if (error) throw new Error(error.message);
  const lista = lerChaves(
    (data ?? []).map((c) => c.chave).join(",") ||
      process.env["WEBPOSTO_CHAVES"] ||
      process.env["WEBPOSTO_CHAVE"],
  );
  if (!lista.length)
    throw new Error("Chaves do webPosto não configuradas (Vault: webposto_chave_1, _2, …).");
  return lista;
}

async function chamar(chave: string, endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("chave", chave);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Key ${chave}`, Accept: "application/json" },
  });
  const texto = await res.text();
  if (res.status === 401 || res.status === 403)
    throw new Error(
      "O webPosto recusou a chave. Confira a chave e se o contrato API Integração está liberado.",
    );
  if (!res.ok)
    throw new Error(`webPosto ${endpoint} respondeu ${res.status}: ${texto.slice(0, 200)}`);
  if (!texto.trim()) return [];
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new Error(`webPosto ${endpoint} não devolveu JSON: ${texto.slice(0, 200)}`);
  }
}

async function exigirAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Somente administradores podem usar a integração do webPosto.");
}

export const listarEmpresasWebPosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const lista: Registro[] = [];
    for (const chave of await chaves(context.supabase))
      lista.push(...extrairLista(await chamar(chave, "EMPRESAS", {})));
    return lista.map((e) => ({
      codigo: empresaRegistro(e) ?? Number(chaveRegistro(e, "EMPRESA")),
      nome: String(
        ["fantasia", "nomeFantasia", "razao", "razaoSocial", "nome"]
          .map((k) => e[k])
          .find(Boolean) ?? JSON.stringify(e).slice(0, 80),
      ),
    }));
  });

export const importarWebPosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      endpoint: z.string().regex(/^[A-Z_]+$/, "Endpoint inválido."),
      dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabase } = context;
    if (data.dataFinal < data.dataInicial) throw new Error("A data final é anterior à inicial.");

    const { data: unidades } = await supabase.from("unidades").select("id, webposto_empresa");
    const porEmpresa = new Map(
      (unidades ?? [])
        .filter((u) => u.webposto_empresa != null)
        .map((u) => [u.webposto_empresa!, u.id]),
    );

    let quantidade = 0;
    let semUnidade = 0;
    let erro: string | null = null;
    const lista_chaves = await chaves(supabase);
    const erros: string[] = [];
    for (const [n, chave] of lista_chaves.entries()) {
      let ultimo = 0;
      try {
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
          const corpo = await chamar(chave, data.endpoint, {
            dataInicial: data.dataInicial,
            dataFinal: data.dataFinal,
            ultimoCodigo: ultimo,
            limite: LIMITE,
          });
          const lista = extrairLista(corpo);
          if (!lista.length) break;
          const linhas = lista.map((r) => {
            const empresa = empresaRegistro(r);
            const unidade = empresa != null ? (porEmpresa.get(empresa) ?? null) : null;
            if (!unidade) semUnidade++;
            return {
              endpoint: data.endpoint,
              // Cada posto numera os seus registros: o código leva o posto para um não sobrescrever o outro.
              codigo: codigoGravado(r, data.endpoint, empresa ?? `chave${n + 1}`),
              empresa_codigo: empresa,
              unidade_id: unidade,
              data_ref: dataRegistro(r),
              dados: r as Json,
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
          const proximo = proximoCodigo(corpo, lista, data.endpoint, ultimo);
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
    if (erros.length) erro = erros.join(" | ");

    await supabase.from("webposto_importacoes").insert({
      endpoint: data.endpoint,
      data_inicial: data.dataInicial,
      data_final: data.dataFinal,
      quantidade,
      sem_unidade: semUnidade,
      erro,
    });
    if (erro)
      throw new Error(quantidade ? `${erro} (${quantidade} registros já importados)` : erro);
    return { quantidade, semUnidade };
  });
