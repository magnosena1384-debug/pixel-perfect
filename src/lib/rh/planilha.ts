// Leitura dos relatórios exportados em Excel pelo QuarkRH. Recebe as linhas da planilha (como
// devolvidas por linhasDoArquivo) e devolve registros prontos para gravar. Sem acesso a arquivo
// nem a banco: tudo aqui é puro, para ser provado com linhas inventadas.

export class ErroRelatorio extends Error {}

export type Problema = { linha: number; motivo: string };

export type DiaPonto = {
  colaborador: string; // nome normalizado: a chave da pessoa dentro da unidade
  nome: string;
  data: string; // AAAA-MM-DD
  jornada: string;
  batidas: string[];
  // minutos de cada coluna do relatório
  diurna: number;
  noturna: number;
  extras: number;
  extras100: number;
  hn: number;
  descontos: number;
  observacao: string;
  folga: boolean;
  trabalhou: boolean;
};

export type Somatorio = Pick<
  DiaPonto,
  "diurna" | "noturna" | "extras" | "hn" | "extras100" | "descontos"
>;

export type RelatorioFrequencia = {
  tipo: "frequencia";
  de: string;
  ate: string;
  dias: DiaPonto[];
  /** Linha "Somatório" de cada colaborador, como o QuarkRH calculou. */
  somatorios: Map<string, Somatorio>;
  problemas: Problema[];
};

export type Irregularidade = {
  colaborador: string;
  nome: string;
  cpf: string;
  cargo: string;
  setor: string;
  vinculo: string;
  /** Como o QuarkRH escreve: FALTA, ATRASO, HORA_EXTRA, INTRAJORNADA, JORNADA_MAXIMA… */
  tipo: string;
  data: string;
};

export type RelatorioIrregularidades = {
  tipo: "irregularidades";
  de: string;
  ate: string;
  irregularidades: Irregularidade[];
  problemas: Problema[];
};

export type Relatorio = RelatorioFrequencia | RelatorioIrregularidades;

const NAO_RECONHECIDO =
  "Este arquivo não parece um relatório do QuarkRH (Frequência, Irregularidades ou Banco de Horas).";

export function normalizarNome(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** "94:22" → 5662; "-01:12" → -72; vazio ou "--:--" → 0. */
export function horasParaMin(valor: unknown) {
  const m = /^(-?)(\d+):(\d{2})$/.exec(texto(valor));
  if (!m) return 0;
  const min = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -min : min;
}

export function minParaHoras(min: number) {
  const abs = Math.abs(Math.round(min));
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  return `${min < 0 ? "-" : ""}${h}:${String(abs % 60).padStart(2, "0")}`;
}

function texto(v: unknown) {
  return v == null ? "" : String(v).trim();
}

/** "01/10/2026" → "2026-10-01", ou null se não for uma data de verdade. */
export function dataIso(v: unknown) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto(v));
  if (!m) return null;
  const [, d, mes, a] = m;
  const data = new Date(Number(a), Number(mes) - 1, Number(d));
  if (data.getDate() !== Number(d) || data.getMonth() !== Number(mes) - 1) return null;
  return `${a}-${mes}-${d}`;
}

const pareceData = (v: unknown) => /^\d{2}\/\d{2}\/\d{4}$/.test(texto(v));

/** O que a prévia e a mensagem de "deu certo" mostram sobre o arquivo lido. */
export function resumoDoArquivo(r: Relatorio) {
  const registros: { colaborador: string; tipo?: string }[] =
    r.tipo === "frequencia" ? r.dias : r.irregularidades;
  const porTipo: Record<string, number> = {};
  if (r.tipo === "irregularidades")
    for (const i of r.irregularidades) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
  return {
    colaboradores: new Set(registros.map((x) => x.colaborador)).size,
    registros: registros.length,
    unidade: r.tipo === "frequencia" ? "dias" : "ocorrências",
    porTipo,
  };
}

/** O dia de ponto no formato das colunas de rh_ponto_dias (o que rh_gravar_ponto recebe). */
export function diaParaBanco(d: DiaPonto) {
  return {
    colaborador: d.colaborador,
    nome: d.nome,
    data: d.data,
    jornada: d.jornada,
    batidas: d.batidas,
    diurna_min: d.diurna,
    noturna_min: d.noturna,
    extras_min: d.extras,
    extras100_min: d.extras100,
    hn_min: d.hn,
    descontos_min: d.descontos,
    observacao: d.observacao,
    folga: d.folga,
    trabalhou: d.trabalhou,
  };
}

export function lerRelatorio(linhas: unknown[][]): Relatorio {
  if (linhas.some((l) => texto(l[0]) === "Dia" && texto(l[1]) === "Jornada"))
    return lerFrequencia(linhas);
  if (
    linhas.some(
      (l) => texto(l[0]) === "Data Inicial" && l.some((c) => texto(c) === "Irregularidade"),
    )
  )
    return lerIrregularidades(linhas);
  throw new ErroRelatorio(NAO_RECONHECIDO);
}

function lerIrregularidades(linhas: unknown[][]): RelatorioIrregularidades {
  const i0 = linhas.findIndex((l) => texto(l[0]) === "Data Inicial");
  const col = Object.fromEntries(linhas[i0]!.map((c, j) => [texto(c), j]));
  const campo = (l: unknown[], nome: string) => texto(l[col[nome]!]);
  const irregularidades: Irregularidade[] = [];
  const problemas: Problema[] = [];
  let de = "";
  let ate = "";

  linhas.slice(i0 + 1).forEach((l, k) => {
    const nome = campo(l, "Nome do Colaborador");
    const tipo = campo(l, "Irregularidade");
    if (!nome || !tipo) return; // linha de total
    de ||= dataIso(campo(l, "Data Inicial")) ?? "";
    ate ||= dataIso(campo(l, "Data Final")) ?? "";
    const base = {
      colaborador: normalizarNome(nome),
      nome: nome.replace(/\s+/g, " ").trim(),
      cpf: campo(l, "CPF"),
      cargo: campo(l, "Cargo"),
      setor: campo(l, "Setor"),
      vinculo: campo(l, "Vínculo"),
      tipo,
    };
    for (const d of campo(l, "Datas")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const data = dataIso(d);
      if (data) irregularidades.push({ ...base, data });
      else problemas.push({ linha: i0 + k + 2, motivo: `Data inválida: ${d}` });
    }
  });

  if (!irregularidades.length && !problemas.length) throw new ErroRelatorio(NAO_RECONHECIDO);
  if (!de || !ate) {
    const datas = irregularidades.map((i) => i.data).sort();
    de ||= datas[0] ?? "";
    ate ||= datas.at(-1) ?? "";
  }
  return { tipo: "irregularidades", de, ate, irregularidades, problemas };
}

function lerFrequencia(linhas: unknown[][]): RelatorioFrequencia {
  const dias: DiaPonto[] = [];
  const somatorios = new Map<string, Somatorio>();
  const problemas: Problema[] = [];
  let nome = "";
  let colunas: Record<string, number> = {};

  const minutos = (l: unknown[]): Somatorio => ({
    diurna: horasParaMin(l[colunas["Diurna"]!]),
    noturna: horasParaMin(l[colunas["Noturna"]!]),
    extras: horasParaMin(l[colunas["Extras Normais"]!]),
    hn: horasParaMin(l[colunas["H.N."]!]),
    extras100: horasParaMin(l[colunas["Extras 100%"]!]),
    descontos: horasParaMin(l[colunas["Descontos"]!]),
  });

  linhas.forEach((l, i) => {
    const primeira = texto(l[0]);
    if (primeira === "Dia" && texto(l[1]) === "Jornada") {
      // Cada colaborador tem o próprio cabeçalho: 2 ou 3 pares de batidas mudam as posições.
      colunas = Object.fromEntries(l.map((c, j) => [texto(c), j]));
      return;
    }
    if (l.some((c) => texto(c) === "Somatório:")) {
      if (nome) somatorios.set(normalizarNome(nome), minutos(l));
      return;
    }
    if (pareceData(primeira)) {
      const data = dataIso(primeira);
      if (!nome || !("Diurna" in colunas)) {
        problemas.push({ linha: i + 1, motivo: "Dia fora da seção de um colaborador" });
        return;
      }
      if (!data) {
        problemas.push({ linha: i + 1, motivo: `Data inválida: ${primeira}` });
        return;
      }
      const batidas = Object.entries(colunas)
        .filter(([c]) => /^(Ent|Sai)\. \d$/.test(c))
        .map(([, j]) => texto(l[j]))
        .filter((b) => /^\d{2}:\d{2}$/.test(b));
      const jornada = texto(l[colunas["Jornada"]!]);
      dias.push({
        colaborador: normalizarNome(nome),
        nome,
        data,
        jornada,
        batidas,
        ...minutos(l),
        observacao: texto(l[colunas["Observações"]!]),
        folga: /FOLGA/i.test(jornada),
        trabalhou: batidas.length > 0,
      });
      return;
    }
    // Linha só com um texto: começa a seção de um colaborador.
    if (primeira && l.slice(1).every((c) => !texto(c))) {
      nome = primeira;
      colunas = {};
    }
  });

  if (!dias.length) throw new ErroRelatorio(NAO_RECONHECIDO);
  const datas = dias.map((d) => d.data).sort();
  return { tipo: "frequencia", de: datas[0]!, ate: datas.at(-1)!, dias, somatorios, problemas };
}
