import { describe, expect, it } from "vitest";
import {
  casarVendas,
  horasPorSetor,
  diasQueContam,
  mesAMes,
  minutosTrabalhados,
  porColaborador,
  porUnidade,
  resumoRh,
  saldoBanco,
  setores,
} from "@/lib/rh/indicadores";
import {
  normalizarNome,
  type BancoHoras,
  type DiaPonto,
  type Irregularidade,
} from "@/lib/rh/planilha";

const dia = (p: Partial<DiaPonto> & { colaborador: string; data: string }): DiaPonto => ({
  nome: p.colaborador,
  jornada: "08:00 - 12:00 14:00 - 18:00",
  batidas: ["08:00", "12:00", "14:00", "18:00"],
  diurna: 0,
  noturna: 0,
  extras: 0,
  extras100: 0,
  hn: 0,
  descontos: 0,
  observacao: "",
  folga: false,
  trabalhou: true,
  ...p,
});

describe("RH: horas trabalhadas", () => {
  it("soma Diurna, Noturna, Extras Normais e Extras 100%, sem a H.N.", () => {
    expect(
      minutosTrabalhados(
        dia({
          colaborador: "A",
          data: "2026-10-01",
          diurna: 480,
          noturna: 30,
          extras: 34,
          extras100: 0,
          hn: 8,
        }),
      ),
    ).toBe(544);
  });

  it("feriado com só 04:09 em Extras 100% conta 04:09", () => {
    expect(minutosTrabalhados(dia({ colaborador: "A", data: "2026-10-12", extras100: 249 }))).toBe(
      249,
    );
  });

  it("dá o total e a média por colaborador com ponto no período", () => {
    const r = resumoRh([
      dia({ colaborador: "A", data: "2026-10-01", diurna: 480 }),
      dia({ colaborador: "A", data: "2026-10-02", diurna: 480, extras: 60 }),
      dia({ colaborador: "B", data: "2026-10-01", diurna: 240 }),
      dia({ colaborador: "B", data: "2026-10-02", folga: true, trabalhou: false, batidas: [] }),
    ]);
    expect(r).toMatchObject({ minutos: 1260, colaboradores: 2, mediaMinutos: 630 });
  });

  it("sem dias, zera sem dividir por zero", () => {
    expect(resumoRh([])).toMatchObject({ minutos: 0, colaboradores: 0, mediaMinutos: 0 });
  });
});

const irr = (colaborador: string, tipo: string, data: string): Irregularidade => ({
  colaborador,
  nome: colaborador,
  cpf: "",
  cargo: "",
  setor: "",
  vinculo: "",
  tipo,
  data,
});

describe("RH: faltas, atrasos, pontualidade e atestados", () => {
  it("conta faltas e atrasos como o QuarkRH marcou", () => {
    const r = resumoRh(
      [],
      [
        irr("A", "FALTA", "2026-10-02"),
        irr("A", "FALTA", "2026-10-03"),
        irr("A", "ATRASO", "2026-10-04"),
        irr("A", "HORA_EXTRA", "2026-10-05"),
      ],
    );
    expect(r).toMatchObject({ faltas: 2, atrasos: 1 });
  });

  it("minutos de atraso = Descontos do ponto nos dias de ATRASO; falta fica fora", () => {
    const dias = [
      dia({ colaborador: "A", data: "2026-10-09", descontos: 53 }),
      dia({ colaborador: "A", data: "2026-10-13", descontos: 91 }),
      dia({ colaborador: "A", data: "2026-10-02", descontos: 480, trabalhou: false, batidas: [] }),
    ];
    const r = resumoRh(dias, [
      irr("A", "ATRASO", "2026-10-09"),
      irr("A", "ATRASO", "2026-10-13"),
      irr("A", "FALTA", "2026-10-02"),
    ]);
    expect(r.minutosAtraso).toBe(144);
  });

  it("pontualidade = dias trabalhados sem ATRASO ÷ dias trabalhados", () => {
    const dias = Array.from({ length: 10 }, (_, i) =>
      dia({ colaborador: "A", data: `2026-10-${String(i + 1).padStart(2, "0")}` }),
    );
    dias.push(
      dia({ colaborador: "A", data: "2026-10-11", folga: true, trabalhou: false, batidas: [] }),
    );
    const r = resumoRh(dias, [irr("A", "ATRASO", "2026-10-01"), irr("A", "ATRASO", "2026-10-02")]);
    expect(r.diasTrabalhados).toBe(10);
    expect(r.pontualidade).toBe(80);
  });

  it("sem dia trabalhado, pontualidade fica vazia", () => {
    expect(resumoRh([]).pontualidade).toBeNull();
  });

  it("atestado vem da observação; férias, feriado e abono não contam", () => {
    const dias = [
      dia({
        colaborador: "A",
        data: "2026-10-01",
        trabalhou: false,
        observacao: "Atestado médico",
      }),
      dia({ colaborador: "A", data: "2026-10-02", trabalhou: false, observacao: "ATESTADO" }),
      dia({ colaborador: "A", data: "2026-10-03", trabalhou: false, observacao: "Férias" }),
      dia({ colaborador: "A", data: "2026-10-04", trabalhou: false, observacao: "Feriado" }),
      dia({
        colaborador: "A",
        data: "2026-10-05",
        trabalhou: false,
        observacao: "FOLGA | Abonada (04:00)",
      }),
    ];
    expect(resumoRh(dias)).toMatchObject({ atestados: 2, faltas: 0 });
  });

  it("nome com acento ou espaço diferente entre os relatórios é a mesma pessoa", () => {
    const dias = [
      dia({ colaborador: normalizarNome("José  da Silva "), data: "2026-10-09", descontos: 30 }),
    ];
    expect(
      resumoRh(dias, [irr(normalizarNome("JOSE DA SILVA"), "ATRASO", "2026-10-09")]).minutosAtraso,
    ).toBe(30);
  });
});

const saldo = (colaborador: string, setor: string, min: number): BancoHoras => ({
  colaborador,
  nome: colaborador,
  setor,
  admissao: null,
  credito: 0,
  debito: 0,
  saldo: min,
});

describe("RH: horas extras, banco de horas e setores", () => {
  it("horas extras = Extras Normais + Extras 100%", () => {
    const r = resumoRh([
      dia({ colaborador: "A", data: "2026-10-01", extras: 34 }),
      dia({ colaborador: "A", data: "2026-10-12", extras100: 249 }),
    ]);
    expect(r.minutosExtras).toBe(283);
  });

  it("setor vem das Irregularidades, depois do Banco de Horas, senão Sem setor", () => {
    const setorDe = setores(
      [{ ...irr("A", "FALTA", "2026-10-02"), setor: "PISTA" }],
      [saldo("A", "OPERACIONAL", 0), saldo("B", "LOJA", 0)],
    );
    expect(setorDe("A")).toBe("PISTA");
    expect(setorDe("B")).toBe("LOJA");
    expect(setorDe("C")).toBe("Sem setor");
  });

  it("horas por setor com a média por colaborador do setor", () => {
    const setorDe = setores(
      [],
      [saldo("A", "PISTA", 0), saldo("B", "PISTA", 0), saldo("C", "LOJA", 0)],
    );
    const dias = [
      dia({ colaborador: "A", data: "2026-10-01", diurna: 480 }),
      dia({ colaborador: "B", data: "2026-10-01", diurna: 240 }),
      dia({ colaborador: "C", data: "2026-10-01", diurna: 120 }),
    ];
    expect(horasPorSetor(dias, setorDe)).toEqual([
      { setor: "PISTA", colaboradores: 2, minutos: 720, media: 360 },
      { setor: "LOJA", colaboradores: 1, minutos: 120, media: 120 },
    ]);
  });

  it("saldo do banco soma os saldos, aceitando negativos", () => {
    expect(saldoBanco([saldo("A", "PISTA", 349), saldo("B", "PISTA", -72)])).toBe(277);
  });
});

describe("RH: comparar postos e tabela por colaborador", () => {
  const naUnidade = <T extends object>(unidadeId: string, x: T) => ({ ...x, unidadeId });
  const dias = [
    naUnidade("u1", dia({ colaborador: "A", data: "2026-10-01", diurna: 480 })),
    naUnidade("u1", dia({ colaborador: "B", data: "2026-10-01", diurna: 240 })),
    naUnidade("u2", dia({ colaborador: "C", data: "2026-10-01", diurna: 120 })),
  ];
  const irrs = [
    naUnidade("u1", irr("B", "FALTA", "2026-10-02")),
    naUnidade("u1", irr("A", "ATRASO", "2026-10-01")),
    naUnidade("u1", irr("A", "ATRASO", "2026-10-03")),
    naUnidade("u2", irr("C", "FALTA", "2026-10-02")),
    naUnidade("u2", irr("C", "FALTA", "2026-10-03")),
  ];

  it("dá uma linha por unidade com os números de cada uma", () => {
    const linhas = porUnidade(dias, irrs);
    expect(linhas.map((l) => [l.unidadeId, l.minutos, l.faltas, l.atrasos])).toEqual([
      ["u1", 720, 1, 2],
      ["u2", 120, 2, 0],
    ]);
  });

  it("por colaborador: mais faltas primeiro, depois mais atrasos", () => {
    const linhas = porColaborador(dias, irrs);
    expect(linhas.map((l) => l.colaborador)).toEqual(["C", "B", "A"]);
    expect(linhas[2]).toMatchObject({
      unidadeId: "u1",
      colaborador: "A",
      atrasos: 2,
      minutos: 480,
    });
  });
});

describe("RH: ticket médio de vendas por colaborador", () => {
  const pessoas = [
    { unidadeId: "u1", colaborador: "ANA SOUZA", cpf: "111.222.333-44" },
    { unidadeId: "u1", colaborador: "BRUNO LIMA", cpf: "" },
    { unidadeId: "u2", colaborador: "CARLA DIAS", cpf: "" },
  ];

  it("casa por CPF, mesmo com nome diferente no webPosto", () => {
    const m = casarVendas(pessoas, [
      { unidadeId: "u1", cpf: "11122233344", nome: "ANA P SOUZA", total: 300, cupons: 4 },
    ]);
    expect(m.get("u1|ANA SOUZA")).toEqual({ total: 300, cupons: 4, ticket: 75 });
  });

  it("sem CPF, casa pelo nome na mesma unidade", () => {
    const m = casarVendas(pessoas, [
      { unidadeId: "u1", cpf: null, nome: "Bruno  Lima", total: 100, cupons: 2 },
    ]);
    expect(m.get("u1|BRUNO LIMA")).toEqual({ total: 100, cupons: 2, ticket: 50 });
  });

  it("homônimo em outra unidade não casa", () => {
    const m = casarVendas(pessoas, [
      { unidadeId: "u1", cpf: null, nome: "CARLA DIAS", total: 90, cupons: 3 },
    ]);
    expect(m.has("u2|CARLA DIAS")).toBe(false);
  });

  it("sem vendas, a pessoa fica sem ticket", () => {
    expect(casarVendas(pessoas, []).size).toBe(0);
  });
});

describe("RH: ficha do colaborador", () => {
  it("separa os números mês a mês, em ordem", () => {
    const meses = mesAMes(
      [
        dia({ colaborador: "A", data: "2026-10-01", diurna: 480 }),
        dia({ colaborador: "A", data: "2026-09-30", diurna: 240, descontos: 20 }),
        dia({ colaborador: "A", data: "2026-10-02", diurna: 480 }),
      ],
      [irr("A", "ATRASO", "2026-09-30"), irr("A", "FALTA", "2026-10-05")],
    );
    expect(
      meses.map((m) => [m.mes, m.minutos, m.faltas, m.atrasos, m.minutosAtraso, m.pontualidade]),
    ).toEqual([
      ["2026-09", 240, 0, 1, 20, 0],
      ["2026-10", 960, 1, 0, 0, 100],
    ]);
  });

  it("lista os dias que contam, do mais recente para o mais antigo", () => {
    const lista = diasQueContam(
      [
        dia({ colaborador: "A", data: "2026-10-01", diurna: 480 }),
        dia({
          colaborador: "A",
          data: "2026-10-03",
          trabalhou: false,
          observacao: "Atestado médico",
        }),
        dia({ colaborador: "A", data: "2026-10-04", trabalhou: false, observacao: "Férias" }),
        dia({
          colaborador: "A",
          data: "2026-10-06",
          trabalhou: false,
          observacao: "FOLGA | Abonada (04:00)",
        }),
        dia({ colaborador: "A", data: "2026-10-12", observacao: "Feriado" }),
      ],
      [
        irr("A", "FALTA", "2026-10-02"),
        irr("A", "ATRASO", "2026-10-05"),
        irr("A", "HORA_EXTRA", "2026-10-01"),
      ],
    );
    expect(lista.map((d) => [d.data, d.tipo])).toEqual([
      ["2026-10-06", "Abono"],
      ["2026-10-05", "Atraso"],
      ["2026-10-04", "Férias"],
      ["2026-10-03", "Atestado"],
      ["2026-10-02", "Falta"],
    ]);
    expect(lista.find((d) => d.tipo === "Atestado")?.observacao).toBe("Atestado médico");
  });
});
