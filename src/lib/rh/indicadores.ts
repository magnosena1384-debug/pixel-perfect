import { normalizarNome, type BancoHoras, type DiaPonto, type Irregularidade } from "./planilha";

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
  minutosExtras: number;
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
  const pontuais = trabalhados.filter((d) => !comAtraso(d)).length;
  return {
    minutos,
    colaboradores,
    mediaMinutos: colaboradores ? Math.round(minutos / colaboradores) : 0,
    minutosExtras: dias.reduce((s, d) => s + d.extras + d.extras100, 0),
    faltas: irregularidades.filter((i) => i.tipo === "FALTA").length,
    atrasos: atrasos.length,
    minutosAtraso: dias.filter(comAtraso).reduce((s, d) => s + d.descontos, 0),
    diasTrabalhados: trabalhados.length,
    pontualidade: trabalhados.length
      ? Math.round((pontuais / trabalhados.length) * 1000) / 10
      : null,
    atestados: dias.filter(ehAtestado).length,
  };
}

export const SEM_SETOR = "Sem setor";

/** Setor de cada pessoa: o das Irregularidades, senão o do Banco de Horas, senão "Sem setor". */
export function setores(irregularidades: Irregularidade[], banco: BancoHoras[]) {
  const mapa = new Map<string, string>();
  for (const b of banco) if (b.setor) mapa.set(b.colaborador, b.setor);
  for (const i of irregularidades) if (i.setor) mapa.set(i.colaborador, i.setor);
  return (colaborador: string) => mapa.get(colaborador) ?? SEM_SETOR;
}

export function horasPorSetor(dias: DiaPonto[], setorDe: (colaborador: string) => string) {
  const grupos = new Map<string, DiaPonto[]>();
  for (const d of dias) {
    const s = setorDe(d.colaborador);
    grupos.set(s, [...(grupos.get(s) ?? []), d]);
  }
  return [...grupos]
    .map(([setor, ds]) => {
      const { minutos, colaboradores, mediaMinutos } = resumoRh(ds);
      return { setor, colaboradores, minutos, media: mediaMinutos };
    })
    .sort((a, b) => b.minutos - a.minutos);
}

export function saldoBanco(banco: BancoHoras[]) {
  return banco.reduce((s, b) => s + b.saldo, 0);
}
