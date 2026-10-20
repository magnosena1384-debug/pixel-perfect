import { normalizarNome, type DiaPonto, type Irregularidade } from "./planilha";

// Contas do painel de RH. Todas as telas (painel, comparação, ficha) usam estas funções.

/** Horas trabalhadas no dia: Diurna + Noturna + Extras Normais + Extras 100% (a H.N. não soma). */
export function minutosTrabalhados(d: DiaPonto) {
  return d.diurna + d.noturna + d.extras + d.extras100;
}

/** Atestado é o que o QuarkRH escreve na observação do dia (não há relatório próprio). */
export function ehAtestado(d: DiaPonto) {
  return normalizarNome(d.observacao).includes("ATESTADO");
}

export type ResumoRh = {
  minutos: number;
  colaboradores: number;
  mediaMinutos: number;
  faltas: number;
  atrasos: number;
  minutosAtraso: number;
  diasTrabalhados: number;
  /** % dos dias trabalhados sem ATRASO; null sem nenhum dia trabalhado. */
  pontualidade: number | null;
  atestados: number;
};

const chave = (colaborador: string, data: string) => `${colaborador}|${data}`;

/** Recebe os dias e as irregularidades já filtrados pelo mesmo período, unidade e pessoa. */
export function resumoRh(dias: DiaPonto[], irregularidades: Irregularidade[] = []): ResumoRh {
  const minutos = dias.reduce((s, d) => s + minutosTrabalhados(d), 0);
  const colaboradores = new Set(dias.map((d) => d.colaborador)).size;
  const atrasos = irregularidades.filter((i) => i.tipo === "ATRASO");
  const diasDeAtraso = new Set(atrasos.map((i) => chave(i.colaborador, i.data)));
  const comAtraso = (d: DiaPonto) => diasDeAtraso.has(chave(d.colaborador, d.data));
  const trabalhados = dias.filter((d) => d.trabalhou);
  return {
    minutos,
    colaboradores,
    mediaMinutos: colaboradores ? Math.round(minutos / colaboradores) : 0,
    faltas: irregularidades.filter((i) => i.tipo === "FALTA").length,
    atrasos: atrasos.length,
    minutosAtraso: dias.filter(comAtraso).reduce((s, d) => s + d.descontos, 0),
    diasTrabalhados: trabalhados.length,
    pontualidade: trabalhados.length
      ? Math.round((trabalhados.filter((d) => !comAtraso(d)).length / trabalhados.length) * 1000) /
        10
      : null,
    atestados: dias.filter(ehAtestado).length,
  };
}
