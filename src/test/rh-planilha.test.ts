import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linhasDoArquivo } from "@/lib/rh/excel";
import {
  diaParaBanco,
  ErroRelatorio,
  horasParaMin,
  lerRelatorio,
  minParaHoras,
  normalizarNome,
  type RelatorioFrequencia,
  type Somatorio,
} from "@/lib/rh/planilha";

// Mesmo formato do "Relatório de Frequência Analítico" do QuarkRH, com nomes inventados.
const CAB2 = [
  "Dia",
  "Jornada",
  "Ent. 1",
  "Sai. 1",
  "Ent. 2",
  "Sai. 2",
  "Diurna",
  "Noturna",
  "Extras Normais",
  "H.N.",
  "Extras 100%",
  "Descontos",
  "Observações",
];
const CAB3 = [
  "Dia",
  "Jornada",
  "Ent. 1",
  "Sai. 1",
  "Ent. 2",
  "Sai. 2",
  "Ent. 3",
  "Sai. 3",
  "Diurna",
  "Noturna",
  "Extras Normais",
  "H.N.",
  "Extras 100%",
  "Descontos",
  "Observações",
];
const J = "08:00 - 12:00 14:00 - 18:00";
const SEM = "--:--";

const frequencia: unknown[][] = [
  ["ANA PAULA DE SOUZA"],
  CAB2,
  [
    "01/10/2026",
    J,
    "07:45",
    "12:01",
    "13:55",
    "15:00",
    "05:21",
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "02:39",
    "",
  ],
  [
    "02/10/2026",
    J,
    "08:04",
    "12:22",
    "14:07",
    "18:23",
    "08:00",
    "00:00",
    "00:34",
    "00:00",
    "00:00",
    "00:00",
    "",
  ],
  [
    "04/10/2026",
    "FOLGA",
    SEM,
    SEM,
    SEM,
    SEM,
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "",
  ],
  [
    "12/10/2026",
    J,
    "07:51",
    "12:00",
    SEM,
    SEM,
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "04:09",
    "00:00",
    "Feriado",
  ],
  [
    null,
    null,
    null,
    null,
    null,
    "Somatório:",
    "13:21",
    "00:00",
    "00:34",
    "00:00",
    "04:09",
    "02:39",
  ],
  ["BRUNO LIMA"],
  CAB3,
  [
    "01/10/2026",
    J,
    "08:05",
    "12:29",
    "14:28",
    "18:04",
    "21:12",
    "22:08",
    "08:00",
    "00:00",
    "00:48",
    "00:08",
    "00:00",
    "00:00",
    "",
  ],
  [
    "02/10/2026",
    J,
    SEM,
    SEM,
    SEM,
    SEM,
    SEM,
    SEM,
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "00:00",
    "08:00",
    "",
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "Somatório:",
    "08:00",
    "00:00",
    "00:48",
    "00:08",
    "00:00",
    "08:00",
  ],
];

const lerFrequencia = (linhas: unknown[][]) => {
  const r = lerRelatorio(linhas);
  if (r.tipo !== "frequencia") throw new Error(`esperava frequência, veio ${r.tipo}`);
  return r;
};

/** Soma de cada coluna por colaborador, para comparar com a linha "Somatório" do relatório. */
function somasPorColaborador(r: RelatorioFrequencia) {
  const somas = new Map<string, Somatorio>();
  for (const d of r.dias) {
    const s: Somatorio = somas.get(d.colaborador) ?? {
      diurna: 0,
      noturna: 0,
      extras: 0,
      hn: 0,
      extras100: 0,
      descontos: 0,
    };
    s.diurna += d.diurna;
    s.noturna += d.noturna;
    s.extras += d.extras;
    s.hn += d.hn;
    s.extras100 += d.extras100;
    s.descontos += d.descontos;
    somas.set(d.colaborador, s);
  }
  return somas;
}

describe("RH: horas no formato do QuarkRH", () => {
  it("converte HH:MM em minutos e volta, aceitando negativo e mais de 24h", () => {
    expect(horasParaMin("94:22")).toBe(5662);
    expect(horasParaMin("-01:12")).toBe(-72);
    expect(horasParaMin("--:--")).toBe(0);
    expect(minParaHoras(5662)).toBe("94:22");
    expect(minParaHoras(-72)).toBe("-01:12");
  });

  it("normaliza nome sem acento, em maiúsculas e sem espaço sobrando", () => {
    expect(normalizarNome("  José  da Silva ")).toBe("JOSE DA SILVA");
  });
});

describe("RH: Relatório de Frequência Analítico", () => {
  it("vira um dia de ponto por linha, com 2 ou 3 pares de batidas", () => {
    const r = lerFrequencia(frequencia);
    expect(r.de).toBe("2026-10-01");
    expect(r.ate).toBe("2026-10-12");
    expect(r.dias).toHaveLength(6);
    const bruno1 = r.dias.find((d) => d.colaborador === "BRUNO LIMA" && d.data === "2026-10-01")!;
    expect(bruno1.batidas).toEqual(["08:05", "12:29", "14:28", "18:04", "21:12", "22:08"]);
    expect(bruno1).toMatchObject({ diurna: 480, extras: 48, hn: 8, trabalhou: true, folga: false });
    const folga = r.dias.find((d) => d.data === "2026-10-04")!;
    expect(folga).toMatchObject({ folga: true, trabalhou: false, batidas: [] });
    const falta = r.dias.find((d) => d.colaborador === "BRUNO LIMA" && d.data === "2026-10-02")!;
    expect(falta).toMatchObject({ trabalhou: false, descontos: 480 });
  });

  it("guarda a observação e a jornada do dia", () => {
    const feriado = lerFrequencia(frequencia).dias.find((d) => d.data === "2026-10-12")!;
    expect(feriado).toMatchObject({
      observacao: "Feriado",
      jornada: J,
      nome: "ANA PAULA DE SOUZA",
    });
  });

  it("a soma de cada coluna bate com o Somatório de cada colaborador", () => {
    const r = lerFrequencia(frequencia);
    const somas = somasPorColaborador(r);
    expect(r.somatorios.size).toBe(2);
    for (const [colaborador, esperado] of r.somatorios)
      expect(somas.get(colaborador)).toEqual(esperado);
  });

  it("monta o dia no formato que o banco grava", () => {
    const feriado = lerFrequencia(frequencia).dias.find((d) => d.data === "2026-10-12")!;
    expect(diaParaBanco(feriado)).toEqual({
      colaborador: "ANA PAULA DE SOUZA",
      nome: "ANA PAULA DE SOUZA",
      data: "2026-10-12",
      jornada: J,
      batidas: ["07:51", "12:00"],
      diurna_min: 0,
      noturna_min: 0,
      extras_min: 0,
      extras100_min: 249,
      hn_min: 0,
      descontos_min: 0,
      observacao: "Feriado",
      folga: false,
      trabalhou: true,
    });
  });

  it("recusa um arquivo que não é relatório do QuarkRH", () => {
    expect(() =>
      lerRelatorio([
        ["Produto", "Preço"],
        ["A", "1"],
      ]),
    ).toThrow(ErroRelatorio);
    expect(() => lerRelatorio([["Produto", "Preço"]])).toThrow(
      /não parece um relatório do QuarkRH/,
    );
  });

  it("aponta a linha que não deu para ler, sem perder as outras", () => {
    const comDefeito = [
      ...frequencia.slice(0, 3),
      [
        "32/10/2026",
        J,
        "08:00",
        "12:00",
        SEM,
        SEM,
        "04:00",
        "00:00",
        "00:00",
        "00:00",
        "00:00",
        "00:00",
        "",
      ],
      ...frequencia.slice(3),
    ];
    const r = lerFrequencia(comDefeito);
    expect(r.dias).toHaveLength(6);
    expect(r.problemas).toEqual([{ linha: 4, motivo: expect.stringMatching(/data/i) }]);
  });
});

// Só roda nesta máquina: as planilhas reais ficam fora do Git (docs/contexto/).
const REAL = "docs/contexto/quarkrh/RelatorioFrequenciaAnalitico.xls";
describe.skipIf(!existsSync(REAL))("RH: Frequência real do QuarkRH", () => {
  it("lê 13 colaboradores e 247 dias, e todos os somatórios batem", () => {
    const r = lerFrequencia(linhasDoArquivo(readFileSync(REAL)));
    expect(new Set(r.dias.map((d) => d.colaborador)).size).toBe(13);
    expect(r.dias).toHaveLength(247);
    expect(r.problemas).toEqual([]);
    const somas = somasPorColaborador(r);
    for (const [colaborador, esperado] of r.somatorios)
      expect(somas.get(colaborador)).toEqual(esperado);
  });
});
