import { describe, expect, it } from "vitest";
import { minutosTrabalhados, resumoRh } from "@/lib/rh/indicadores";
import { normalizarNome, type DiaPonto, type Irregularidade } from "@/lib/rh/planilha";

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
