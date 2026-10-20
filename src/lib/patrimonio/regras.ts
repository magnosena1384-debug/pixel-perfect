// Regras do patrimônio que valem em todas as telas: categorias, tombamento e depreciação.
// Valores sempre em centavos; datas no formato AAAA-MM-DD.

export const CATEGORIAS = [
  "Bombas e equipamentos de pista",
  "Máquinas e equipamentos",
  "Móveis e utensílios",
  "Informática",
  "Veículos",
  "Ferramentas",
  "Outros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

const VIDA_UTIL: Record<Categoria, number> = {
  "Bombas e equipamentos de pista": 10,
  "Máquinas e equipamentos": 10,
  "Móveis e utensílios": 10,
  Informática: 5,
  Veículos: 5,
  Ferramentas: 5,
  Outros: 10,
};

/** Vida útil sugerida em anos; cada bem pode ter a sua. */
export function vidaUtilSugerida(categoria: string) {
  return VIDA_UTIL[categoria as Categoria] ?? 10;
}

export function formatarTombamento(numero: number) {
  return String(numero).padStart(6, "0");
}

/** Meses completos entre duas datas: de 15/01 a 14/10 são 8; a 15/10, 9. */
export function mesesCompletos(de: string, ate: string) {
  const [ad, md, dd] = de.split("-").map(Number) as [number, number, number];
  const [aa, ma, da] = ate.split("-").map(Number) as [number, number, number];
  return Math.max(0, (aa - ad) * 12 + (ma - md) - (da < dd ? 1 : 0));
}

export type BaseDepreciacao = {
  valorCompra: number;
  vidaUtilAnos: number;
  dataCompra: string;
  baixaData: string | null;
};

/** Linha reta, mês a mês, até hoje ou até a baixa; o valor atual nunca fica abaixo de zero. */
export function depreciacao(bem: BaseDepreciacao, hoje: string) {
  const fim = bem.baixaData && bem.baixaData < hoje ? bem.baixaData : hoje;
  const meses = mesesCompletos(bem.dataCompra, fim);
  const mensal = bem.vidaUtilAnos > 0 ? bem.valorCompra / (bem.vidaUtilAnos * 12) : 0;
  const acumulada = Math.min(bem.valorCompra, Math.round(mensal * meses));
  return {
    mensal: Math.round(mensal),
    meses,
    acumulada,
    atual: bem.valorCompra - acumulada,
  };
}

type BemDoResumo = BaseDepreciacao & { unidadeId: string; categoria: string; situacao: string };

type Somas = { quantidade: number; compra: number; acumulada: number; atual: number };

/** Totais sem os baixados: geral, por empresa e por categoria (maior valor atual primeiro). */
export function resumoPatrimonio(bens: BemDoResumo[], hoje: string) {
  const ativos = bens.filter((b) => b.situacao !== "baixado");
  const somar = (lista: BemDoResumo[]): Somas =>
    lista.reduce(
      (s, b) => {
        const d = depreciacao(b, hoje);
        return {
          quantidade: s.quantidade + 1,
          compra: s.compra + b.valorCompra,
          acumulada: s.acumulada + d.acumulada,
          atual: s.atual + d.atual,
        };
      },
      { quantidade: 0, compra: 0, acumulada: 0, atual: 0 },
    );
  const agrupar = (chave: (b: BemDoResumo) => string) => {
    const grupos = new Map<string, BemDoResumo[]>();
    for (const b of ativos) grupos.set(chave(b), [...(grupos.get(chave(b)) ?? []), b]);
    return [...grupos]
      .map(([k, lista]) => ({ chave: k, ...somar(lista) }))
      .sort((a, b) => b.atual - a.atual);
  };
  return {
    total: somar(ativos),
    porEmpresa: agrupar((b) => b.unidadeId),
    porCategoria: agrupar((b) => b.categoria),
  };
}

/**
 * Valor em reais digitado → centavos. Aceita "1.500,50", "1500,50", "1500.50" e "R$ 12.000";
 * com vírgula, os pontos são de milhar; sem vírgula, um ponto seguido de 1 ou 2 dígitos no fim
 * é o decimal. Devolve null quando não é um valor.
 */
export function centavosDeTexto(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
