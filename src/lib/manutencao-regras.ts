import { addDias, antecedencia, diasAte, hoje, situacao, type Situacao } from "@/lib/gestao";

// Regras da aba de drenagem de tanque e da aba de aferição de bombas e bicos (Manutenção).

/** Drenagem semanal e aferição quinzenal, como no Posto Seguro. */
export const PERIODO_DRENAGEM_DIAS = 7;
export const PERIODO_AFERICAO_DIAS = 15;

export const PRODUTOS_DIESEL = [
  "Diesel S-10",
  "Diesel S-10 aditivado",
  "Diesel S-500",
  "Diesel S-500 aditivado",
] as const;

export type Drenagem = {
  id: string;
  data: string;
  tanque: string;
  produto: string;
  capacidade_litros: number | null;
  volume_amostra_litros: number | null;
  volume_agua_litros: number | null;
  tem_agua: boolean;
  /** "Homogêneo, límpido e isento de material particulado?" (sim é o normal). */
  aspecto_normal: boolean | null;
  /** "Água no medidor/mm?" (não é o normal). */
  agua_no_medidor: boolean | null;
  cor: string | null;
  medida_adotada: string | null;
  responsavel: string | null;
  rg_responsavel: string | null;
  origem_id: string | null;
};

export type Afericao = {
  id: string;
  data: string;
  bomba: string;
  bico: string;
  produto: string;
  responsavel: string | null;
  obs: string | null;
  origem_id: string | null;
  /** Momento exato da aferição (ISO), de onde sai a hora. */
  realizada_em: string | null;
  /** Valor lido no balde aferidor na vazão alta, em ml (tolerância de ± 100 ml). */
  vazao_alta_ml: number | null;
  /** Valor lido no balde aferidor na vazão baixa, em ml (tolerância de ± 100 ml). */
  vazao_baixa_ml: number | null;
};

/** Tolerância da aferição de vazão, em ml, para mais ou para menos. */
export const TOLERANCIA_VAZAO_ML = 100;

export type ResultadoVazao = "aprovado" | "reprovado" | "sem-resultado";

/** Uma vazão está dentro da tolerância se o valor lido vai de -100 a +100 ml (inclusive). */
export function vazaoDentro(ml: number | null): boolean | null {
  return ml == null ? null : Math.abs(ml) <= TOLERANCIA_VAZAO_ML;
}

/**
 * Resultado da aferição: aprovado se as duas vazões lidas estão dentro da tolerância; reprovado se
 * alguma está fora; sem resultado se nenhuma foi informada.
 */
export function resultadoAfericao(alta: number | null, baixa: number | null): ResultadoVazao {
  const lidas = [vazaoDentro(alta), vazaoDentro(baixa)].filter((v) => v !== null);
  if (lidas.length === 0) return "sem-resultado";
  return lidas.every(Boolean) ? "aprovado" : "reprovado";
}

/** "+20 ml", "-40 ml", "0 ml" ou "—" (com o sinal de menos de verdade). */
export function formatarVazao(ml: number | null | undefined): string {
  if (ml == null) return "—";
  return `${ml > 0 ? "+" : ml < 0 ? "−" : ""}${Math.abs(ml)} ml`;
}

/** Hora da aferição, "HH:MM", no horário de Brasília; "—" se não houver. */
export function horaDaAfericao(realizadaEm: string | null | undefined): string {
  if (!realizadaEm) return "—";
  const d = new Date(realizadaEm);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Situação de algo que se repete a cada `periodo` dias, pela data da última vez. */
export function situacaoPeriodica(
  ultima: string | null,
  periodo: number,
  base = hoje(),
): { proxima: string | null; situacao: Situacao } {
  if (!ultima) return { proxima: null, situacao: "vencido" };
  const proxima = addDias(ultima, periodo);
  return { proxima, situacao: situacao(proxima, antecedencia(periodo), base) };
}

export type ResumoTanque = {
  tanque: string;
  produto: string;
  ultima: string;
  total: number;
  comAgua: number;
  proxima: string | null;
  situacao: Situacao;
  diasSemDrenar: number;
};

/** Último lançamento e situação de cada tanque (tanque com número, em ordem numérica). */
export function resumoPorTanque(drenagens: Drenagem[], base = hoje()): ResumoTanque[] {
  const por = new Map<string, Drenagem[]>();
  for (const d of drenagens) por.set(d.tanque, [...(por.get(d.tanque) ?? []), d]);
  return [...por.entries()]
    .map(([tanque, lista]) => {
      const maisRecente = lista.reduce((a, b) => (b.data > a.data ? b : a));
      const s = situacaoPeriodica(maisRecente.data, PERIODO_DRENAGEM_DIAS, base);
      return {
        tanque,
        produto: maisRecente.produto,
        ultima: maisRecente.data,
        total: lista.length,
        comAgua: lista.filter((d) => d.tem_agua).length,
        proxima: s.proxima,
        situacao: s.situacao,
        diasSemDrenar: Math.max(0, -diasAte(maisRecente.data, base)),
      };
    })
    .sort((a, b) => a.tanque.localeCompare(b.tanque, "pt-BR", { numeric: true }));
}

export type GrupoAfericao = {
  chave: string;
  bomba: string;
  bico: string;
  produto: string;
  ultima: string;
  responsavel: string | null;
  proxima: string | null;
  situacao: Situacao;
  historico: Afericao[];
};

/** Um grupo por bomba e bico, com o histórico do mais novo para o mais antigo. */
export function agruparAfericoes(afericoes: Afericao[], base = hoje()): GrupoAfericao[] {
  const por = new Map<string, Afericao[]>();
  for (const a of afericoes) {
    const chave = `${a.bomba}|${a.bico}`;
    por.set(chave, [...(por.get(chave) ?? []), a]);
  }
  return [...por.entries()]
    .map(([chave, lista]) => {
      const historico = [...lista].sort((a, b) => b.data.localeCompare(a.data));
      const ultima = historico[0]!;
      const s = situacaoPeriodica(ultima.data, PERIODO_AFERICAO_DIAS, base);
      return {
        chave,
        bomba: ultima.bomba,
        bico: ultima.bico,
        produto: ultima.produto,
        ultima: ultima.data,
        responsavel: ultima.responsavel,
        proxima: s.proxima,
        situacao: s.situacao,
        historico,
      };
    })
    .sort(
      (a, b) =>
        a.bomba.localeCompare(b.bomba, "pt-BR", { numeric: true }) ||
        a.bico.localeCompare(b.bico, "pt-BR", { numeric: true }),
    );
}

/** Quantos tanques ou bicos pedem atenção (atrasados ou perto de vencer). */
export function contarPendentes(situacoes: Situacao[]): number {
  return situacoes.filter((s) => s === "vencido" || s === "proximo").length;
}

/** "1.234,5 L". */
export function formatarLitros(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
}
