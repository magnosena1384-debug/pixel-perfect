import { formatarTombamento } from "./regras";

// Montagem das páginas de etiquetas, em milímetros. A página de impressão só desenha o que
// esta função calcula; a conta fica aqui para ser provada sem impressora.

export const FORMATOS = {
  // Pimaco 6180 (equivale à Avery 5160): folha Carta, 3 colunas × 10 linhas.
  "pimaco-6180": {
    nome: "Folha Pimaco 6180 (30 por folha)",
    pagina: { largura: 215.9, altura: 279.4 },
    etiqueta: { largura: 66.7, altura: 25.4 },
    colunas: 3,
    linhas: 10,
    margemEsquerda: 4.7625,
    margemTopo: 12.7,
    passoHorizontal: 69.85,
    passoVertical: 25.4,
  },
  "termica-50x30": {
    nome: "Térmica 50 × 30 mm",
    pagina: { largura: 50, altura: 30 },
    etiqueta: { largura: 50, altura: 30 },
    colunas: 1,
    linhas: 1,
    margemEsquerda: 0,
    margemTopo: 0,
    passoHorizontal: 50,
    passoVertical: 30,
  },
} as const;

export type Formato = keyof typeof FORMATOS;

export type BemDaEtiqueta = { tombamento: number; nome: string; empresa: string };

export type Etiqueta = {
  x: number;
  y: number;
  largura: number;
  altura: number;
  qr: string;
  numero: string;
  nome: string;
  empresa: string;
};

export type Pagina = { largura: number; altura: number; etiquetas: Etiqueta[] };

const mm = (v: number) => Math.round(v * 100) / 100;

export function paginasDeEtiquetas(bens: BemDaEtiqueta[], formato: Formato): Pagina[] {
  const f = FORMATOS[formato];
  const porPagina = f.colunas * f.linhas;
  const paginas: Pagina[] = [];
  bens.forEach((bem, i) => {
    const posicao = i % porPagina;
    if (posicao === 0) paginas.push({ ...f.pagina, etiquetas: [] });
    const coluna = posicao % f.colunas;
    const linha = Math.floor(posicao / f.colunas);
    const numero = formatarTombamento(bem.tombamento);
    paginas.at(-1)!.etiquetas.push({
      x: mm(f.margemEsquerda + coluna * f.passoHorizontal),
      y: mm(f.margemTopo + linha * f.passoVertical),
      ...f.etiqueta,
      qr: numero,
      numero,
      nome: bem.nome,
      empresa: bem.empresa,
    });
  });
  return paginas;
}
