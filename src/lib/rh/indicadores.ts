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

type NaUnidade = { unidadeId: string; colaborador: string };

function agrupar<D extends NaUnidade, I extends NaUnidade>(
  dias: D[],
  irregularidades: I[],
  chave: (x: NaUnidade) => string,
) {
  const grupos = new Map<string, { dias: D[]; irregularidades: I[] }>();
  const grupo = (x: NaUnidade) => {
    const k = chave(x);
    if (!grupos.has(k)) grupos.set(k, { dias: [], irregularidades: [] });
    return grupos.get(k)!;
  };
  for (const d of dias) grupo(d).dias.push(d);
  for (const i of irregularidades) grupo(i).irregularidades.push(i);
  return grupos;
}

/** Uma linha por unidade, com os mesmos números do painel, na ordem em que as unidades aparecem. */
export function porUnidade(
  dias: (DiaPonto & NaUnidade)[],
  irregularidades: (Irregularidade & NaUnidade)[],
) {
  return [...agrupar(dias, irregularidades, (x) => x.unidadeId)].map(([unidadeId, g]) => ({
    unidadeId,
    ...resumoRh(g.dias, g.irregularidades),
  }));
}

/** Uma linha por pessoa (em cada unidade): mais faltas primeiro, depois mais atrasos. */
export function porColaborador(
  dias: (DiaPonto & NaUnidade)[],
  irregularidades: (Irregularidade & NaUnidade)[],
) {
  return [...agrupar(dias, irregularidades, (x) => `${x.unidadeId}|${x.colaborador}`)]
    .map(([, g]) => {
      const primeiro = g.dias[0] ?? g.irregularidades[0]!;
      return {
        unidadeId: primeiro.unidadeId,
        colaborador: primeiro.colaborador,
        nome: primeiro.nome,
        cpf: g.irregularidades.find((i) => i.cpf)?.cpf ?? "",
        ...resumoRh(g.dias, g.irregularidades),
      };
    })
    .sort((a, b) => b.faltas - a.faltas || b.atrasos - a.atrasos);
}

export type VendaFuncionario = {
  unidadeId: string;
  cpf: string | null;
  nome: string;
  total: number;
  cupons: number;
};

const soDigitos = (cpf: string | null) => (cpf ?? "").replace(/\D/g, "");

/**
 * Junta as vendas do webPosto com as pessoas do RH: pelo CPF; sem CPF, pelo nome na mesma
 * unidade. Chave do resultado: "unidadeId|colaborador".
 */
export function casarVendas(
  pessoas: { unidadeId: string; colaborador: string; cpf: string }[],
  vendas: VendaFuncionario[],
) {
  const porCpf = new Map<string, VendaFuncionario>();
  const porNome = new Map<string, VendaFuncionario>();
  for (const v of vendas) {
    if (soDigitos(v.cpf)) porCpf.set(`${v.unidadeId}|${soDigitos(v.cpf)}`, v);
    porNome.set(`${v.unidadeId}|${normalizarNome(v.nome)}`, v);
  }
  const resultado = new Map<string, { total: number; cupons: number; ticket: number }>();
  for (const p of pessoas) {
    const v =
      (soDigitos(p.cpf) && porCpf.get(`${p.unidadeId}|${soDigitos(p.cpf)}`)) ||
      porNome.get(`${p.unidadeId}|${p.colaborador}`);
    if (v && v.cupons > 0)
      resultado.set(`${p.unidadeId}|${p.colaborador}`, {
        total: v.total,
        cupons: v.cupons,
        ticket: Math.round((v.total / v.cupons) * 100) / 100,
      });
  }
  return resultado;
}

/** Os números da pessoa mês a mês ("2026-10"), do mais antigo para o mais recente. */
export function mesAMes(dias: DiaPonto[], irregularidades: Irregularidade[]) {
  const meses = [...new Set([...dias, ...irregularidades].map((x) => x.data.slice(0, 7)))].sort();
  return meses.map((mes) => ({
    mes,
    ...resumoRh(
      dias.filter((d) => d.data.startsWith(mes)),
      irregularidades.filter((i) => i.data.startsWith(mes)),
    ),
  }));
}

export type DiaQueConta = {
  data: string;
  tipo: "Falta" | "Atraso" | "Atestado" | "Férias" | "Abono";
  observacao: string;
};

/** Faltas, atrasos, atestados, férias e abonos, do mais recente para o mais antigo. */
export function diasQueContam(dias: DiaPonto[], irregularidades: Irregularidade[]) {
  const lista: DiaQueConta[] = [];
  const obs = new Map(dias.map((d) => [d.data, d.observacao]));
  for (const i of irregularidades)
    if (i.tipo === "FALTA" || i.tipo === "ATRASO")
      lista.push({
        data: i.data,
        tipo: i.tipo === "FALTA" ? "Falta" : "Atraso",
        observacao: obs.get(i.data) ?? "",
      });
  for (const d of dias) {
    const o = normalizarNome(d.observacao);
    const tipo = ehAtestado(d)
      ? "Atestado"
      : o.includes("FERIAS")
        ? "Férias"
        : o.includes("ABONAD")
          ? "Abono"
          : null;
    if (tipo) lista.push({ data: d.data, tipo, observacao: d.observacao });
  }
  return lista.sort((a, b) => b.data.localeCompare(a.data));
}
