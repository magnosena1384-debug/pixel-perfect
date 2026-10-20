import { describe, expect, it } from "vitest";
import { minutosTrabalhados, resumoRh } from "@/lib/rh/indicadores";
import type { DiaPonto } from "@/lib/rh/planilha";

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
