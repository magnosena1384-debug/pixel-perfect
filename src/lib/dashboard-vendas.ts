import { addDias } from "@/lib/gestao";
import type { Registro } from "@/lib/webposto";

// Dashboard de vendas: transforma os registros importados do webPosto (ABASTECIMENTO e
// VENDA_ITEM) em lançamentos e calcula os totais. Os nomes dos campos do webPosto ainda não
// foram confirmados com dados reais; as listas de CAMPOS abaixo são onde ajustar.

export type Categoria = "combustivel" | "produto";

export type Lancamento = {
  unidadeId: string | null;
  data: string;
  hora: number | null;
  colaborador: string;
  categoria: Categoria;
  item: string;
  valorCentavos: number;
  litros: number | null;
  /** Agrupa os itens da mesma venda (cupom) para o ticket médio. */
  cupom: string;
};

export const CAMPOS = {
  valor: ["valorTotal", "totalVenda", "valorVenda", "valorLiquido", "total", "valor", "valorBruto"],
  litros: ["litros", "quantidade", "volume", "qtde", "quantidadeLitros"],
  item: [
    "combustivelNome",
    "nomeCombustivel",
    "produtoNome",
    "nomeProduto",
    "produtoDescricao",
    "descricaoProduto",
    "combustivel",
    "produto",
    "descricao",
  ],
  colaborador: [
    "frentistaNome",
    "nomeFrentista",
    "funcionarioNome",
    "nomeFuncionario",
    "vendedorNome",
    "nomeVendedor",
    "colaboradorNome",
    "operadorNome",
    "frentista",
    "funcionario",
    "vendedor",
  ],
  colaboradorCodigo: ["frentistaCodigo", "funcionarioCodigo", "vendedorCodigo", "operadorCodigo"],
  cupom: ["vendaCodigo", "cupomCodigo", "codigoVenda", "numeroCupom", "cupom", "notaCodigo"],
  hora: ["hora", "horaAbastecimento", "horaVenda", "horaEmissao"],
} as const;

const SEM_COLABORADOR = "Não informado";

/** Valor do primeiro campo da lista presente no registro (sem diferenciar maiúsculas). */
function campo(r: Registro, nomes: readonly string[]): unknown {
  const chaves = new Map(Object.keys(r).map((k) => [k.toLowerCase(), k]));
  for (const n of nomes) {
    const k = chaves.get(n.toLowerCase());
    if (k != null && r[k] != null && r[k] !== "") return r[k];
  }
  return undefined;
}

/** Aceita 12.5, "12.5", "12,50" e "1.234,56". */
export function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

/** Hora (0–23) do campo de hora, ou da parte de hora de um campo de data. */
export function horaRegistro(r: Registro): number | null {
  const h = campo(r, CAMPOS.hora);
  const lerHora = (s: string) => {
    const m = /(?:^|[T\s])(\d{1,2}):\d{2}/.exec(s);
    return m ? Number(m[1]) : null;
  };
  if (typeof h === "number") return Number.isInteger(h) && h >= 0 && h < 24 ? h : null;
  if (typeof h === "string") return lerHora(` ${h}`);
  for (const [k, v] of Object.entries(r)) {
    if (k.toLowerCase().startsWith("data") && typeof v === "string") {
      const hora = lerHora(v);
      if (hora != null && hora < 24) return hora;
    }
  }
  return null;
}

const COMBUSTIVEL = /gasolin|etanol|[aá]lcool|diesel|\bgnv\b|\bs-?10\b|\bs-?500\b/i;

export function ehCombustivel(nome: string) {
  return COMBUSTIVEL.test(nome);
}

function colaborador(r: Registro) {
  const nome = campo(r, CAMPOS.colaborador);
  if (typeof nome === "string" && nome.trim()) return nome.trim();
  const cod = campo(r, CAMPOS.colaboradorCodigo);
  return cod != null && typeof cod !== "object" ? `Código ${String(cod)}` : SEM_COLABORADOR;
}

export type RegistroImportado = {
  endpoint: string;
  codigo: string;
  unidade_id: string | null;
  data_ref: string | null;
  dados: unknown;
};

/**
 * Converte os registros importados em lançamentos. Combustível vem de ABASTECIMENTO; os itens
 * de combustível em VENDA_ITEM só entram quando não há abastecimentos, para não contar duas vezes.
 */
export function paraLancamentos(registros: RegistroImportado[]): Lancamento[] {
  const temAbastecimento = registros.some((r) => r.endpoint === "ABASTECIMENTO");
  const lista: Lancamento[] = [];
  for (const reg of registros) {
    if (!reg.data_ref || !reg.dados || typeof reg.dados !== "object") continue;
    const r = reg.dados as Registro;
    const valor = numero(campo(r, CAMPOS.valor));
    if (valor == null || valor === 0) continue;
    const itemBruto = campo(r, CAMPOS.item);
    const item = typeof itemBruto === "string" && itemBruto.trim() ? itemBruto.trim() : "Sem nome";
    let categoria: Categoria;
    if (reg.endpoint === "ABASTECIMENTO") categoria = "combustivel";
    else if (reg.endpoint === "VENDA_ITEM") {
      categoria = ehCombustivel(item) ? "combustivel" : "produto";
      if (categoria === "combustivel" && temAbastecimento) continue;
    } else continue;
    const cupom = campo(r, CAMPOS.cupom);
    lista.push({
      unidadeId: reg.unidade_id,
      data: reg.data_ref,
      hora: horaRegistro(r),
      colaborador: colaborador(r),
      categoria,
      item,
      valorCentavos: Math.round(valor * 100),
      litros: categoria === "combustivel" ? numero(campo(r, CAMPOS.litros)) : null,
      cupom: `${reg.unidade_id ?? "-"}:${cupom != null ? String(cupom) : `${reg.endpoint}:${reg.codigo}`}`,
    });
  }
  return lista;
}

// ---------- Totais ----------

export type Totais = {
  totalCentavos: number;
  cupons: number;
  /** Ticket médio em centavos (total ÷ número de vendas). */
  ticketCentavos: number;
  litros: number;
};

export function totais(lancs: Lancamento[]): Totais {
  const totalCentavos = lancs.reduce((s, l) => s + l.valorCentavos, 0);
  const cupons = new Set(lancs.map((l) => l.cupom)).size;
  return {
    totalCentavos,
    cupons,
    ticketCentavos: cupons ? Math.round(totalCentavos / cupons) : 0,
    litros: lancs.reduce((s, l) => s + (l.litros ?? 0), 0),
  };
}

export type Grupo = {
  chave: string;
  geral: Totais;
  combustivel: Totais;
  produto: Totais;
};

/** Totais por chave (unidade, colaborador…), separados em combustível e produtos. */
export function agrupar(lancs: Lancamento[], chave: (l: Lancamento) => string): Grupo[] {
  const grupos = new Map<string, Lancamento[]>();
  for (const l of lancs) {
    const k = chave(l);
    const g = grupos.get(k);
    if (g) g.push(l);
    else grupos.set(k, [l]);
  }
  return [...grupos.entries()]
    .map(([k, ls]) => ({
      chave: k,
      geral: totais(ls),
      combustivel: totais(ls.filter((l) => l.categoria === "combustivel")),
      produto: totais(ls.filter((l) => l.categoria === "produto")),
    }))
    .sort((a, b) => b.geral.totalCentavos - a.geral.totalCentavos);
}

export type Hora = { hora: string; combustivel: number; produto: number };

/** Vendas de cada hora do dia (0h a 23h), em reais. */
export function porHora(lancs: Lancamento[]): Hora[] {
  const horas = Array.from({ length: 24 }, (_, h) => ({
    hora: `${String(h).padStart(2, "0")}h`,
    combustivel: 0,
    produto: 0,
  }));
  for (const l of lancs) if (l.hora != null) horas[l.hora]![l.categoria] += l.valorCentavos / 100;
  return horas;
}

export type Combustivel = Totais & { item: string; precoLitroCentavos: number | null };

export function porCombustivel(lancs: Lancamento[]): Combustivel[] {
  return agrupar(
    lancs.filter((l) => l.categoria === "combustivel"),
    (l) => l.item,
  ).map(({ chave, geral }) => ({
    item: chave,
    ...geral,
    precoLitroCentavos: geral.litros ? Math.round(geral.totalCentavos / geral.litros) : null,
  }));
}

// ---------- Dados de exemplo ----------

const EXEMPLO_COMBUSTIVEIS = [
  { item: "Gasolina comum", preco: 6.19, peso: 45 },
  { item: "Gasolina aditivada", preco: 6.49, peso: 12 },
  { item: "Etanol", preco: 4.59, peso: 18 },
  { item: "Diesel S10", preco: 6.09, peso: 20 },
  { item: "Diesel S500", preco: 5.89, peso: 5 },
];
const EXEMPLO_PRODUTOS = [
  { item: "Óleo lubrificante 1L", preco: 42, peso: 10 },
  { item: "Água mineral 500ml", preco: 3.5, peso: 30 },
  { item: "Refrigerante lata", preco: 6, peso: 25 },
  { item: "Café expresso", preco: 7, peso: 20 },
  { item: "Aditivo radiador", preco: 29.9, peso: 5 },
  { item: "Salgado", preco: 8.5, peso: 10 },
];
const EXEMPLO_NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gil", "Helena"];
// Movimento relativo por hora do dia (picos de manhã e no fim da tarde).
const MOVIMENTO = [1, 1, 1, 1, 1, 2, 6, 9, 8, 6, 5, 6, 7, 6, 5, 6, 8, 10, 9, 6, 4, 3, 2, 1];

function sorteador(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function escolher<T extends { peso: number }>(lista: T[], r: number) {
  let alvo = r * lista.reduce((s, x) => s + x.peso, 0);
  for (const x of lista) if ((alvo -= x.peso) < 0) return x;
  return lista[lista.length - 1]!;
}

/** Vendas fictícias, sempre iguais para o mesmo período, só para visualizar o painel. */
export function gerarExemplo(unidadeIds: string[], inicio: string, fim: string): Lancamento[] {
  const lista: Lancamento[] = [];
  const pesoHora = MOVIMENTO.map((peso, hora) => ({ hora, peso }));
  for (let d = 0; d < 93; d++) {
    const dia = addDias(inicio, d);
    if (dia > fim) break;
    unidadeIds.forEach((unidadeId, u) => {
      const rnd = sorteador(Number(dia.replace(/-/g, "")) * 31 + u);
      const equipe = EXEMPLO_NOMES.slice(u % 4, (u % 4) + 4).map((n) => `${n} (exemplo)`);
      const vendas = 40 + Math.floor(rnd() * 30);
      for (let v = 0; v < vendas; v++) {
        const hora = escolher(pesoHora, rnd()).hora;
        const colaborador = equipe[Math.floor(rnd() * equipe.length)]!;
        const cupom = `exemplo:${unidadeId}:${dia}:${v}`;
        const base = { unidadeId, data: dia, hora, colaborador, cupom };
        if (rnd() < 0.85) {
          const c = escolher(EXEMPLO_COMBUSTIVEIS, rnd());
          const litros = Math.round((10 + rnd() * 40) * 100) / 100;
          lista.push({
            ...base,
            categoria: "combustivel",
            item: c.item,
            litros,
            valorCentavos: Math.round(litros * c.preco * 100),
          });
        }
        if (rnd() < 0.35) {
          const p = escolher(EXEMPLO_PRODUTOS, rnd());
          lista.push({
            ...base,
            categoria: "produto",
            item: p.item,
            litros: null,
            valorCentavos: Math.round(p.preco * (1 + Math.floor(rnd() * 2)) * 100),
          });
        }
      }
    });
  }
  return lista;
}
