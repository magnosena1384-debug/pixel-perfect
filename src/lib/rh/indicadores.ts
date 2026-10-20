import type { DiaPonto } from "./planilha";

// Contas do painel de RH. Todas as telas (painel, comparação, ficha) usam estas funções.

/** Horas trabalhadas no dia: Diurna + Noturna + Extras Normais + Extras 100% (a H.N. não soma). */
export function minutosTrabalhados(d: DiaPonto) {
  return d.diurna + d.noturna + d.extras + d.extras100;
}

export type ResumoRh = {
  minutos: number;
  colaboradores: number;
  mediaMinutos: number;
};

export function resumoRh(dias: DiaPonto[]): ResumoRh {
  const minutos = dias.reduce((s, d) => s + minutosTrabalhados(d), 0);
  const colaboradores = new Set(dias.map((d) => d.colaborador)).size;
  return {
    minutos,
    colaboradores,
    mediaMinutos: colaboradores ? Math.round(minutos / colaboradores) : 0,
  };
}
