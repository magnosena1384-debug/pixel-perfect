import { describe, expect, it } from "vitest";
import {
  agruparAfericoes,
  contarPendentes,
  formatarLitros,
  resumoPorTanque,
  situacaoPeriodica,
  type Afericao,
  type Drenagem,
} from "@/lib/manutencao-regras";

const HOJE = "2026-11-13";

const dren = (p: Partial<Drenagem>): Drenagem => ({
  id: Math.random().toString(36),
  data: "2026-11-10",
  tanque: "1",
  produto: "Diesel S-10",
  capacidade_litros: 15000,
  volume_amostra_litros: 2,
  volume_agua_litros: 0,
  tem_agua: false,
  aspecto_normal: true,
  agua_no_medidor: false,
  cor: "Amarelo",
  medida_adotada: null,
  responsavel: "Fulano",
  rg_responsavel: null,
  origem_id: null,
  ...p,
});

const afer = (p: Partial<Afericao>): Afericao => ({
  id: Math.random().toString(36),
  data: "2026-11-01",
  bomba: "1",
  bico: "1",
  produto: "Etanol",
  responsavel: "Fulano",
  obs: null,
  origem_id: null,
  ...p,
});

describe("situacaoPeriodica", () => {
  it("sem lançamento anterior fica pendente", () => {
    expect(situacaoPeriodica(null, 7, HOJE)).toEqual({ proxima: null, situacao: "vencido" });
  });
  it("drenagem semanal: em dia, perto de vencer e atrasada", () => {
    expect(situacaoPeriodica("2026-11-12", 7, HOJE).situacao).toBe("ok");
    expect(situacaoPeriodica("2026-11-07", 7, HOJE).situacao).toBe("proximo");
    expect(situacaoPeriodica("2026-11-05", 7, HOJE).situacao).toBe("vencido");
  });
  it("a próxima data é a última mais o período", () => {
    expect(situacaoPeriodica("2026-11-01", 15, HOJE).proxima).toBe("2026-11-16");
  });
});

describe("resumoPorTanque", () => {
  it("pega o lançamento mais recente de cada tanque, em ordem numérica", () => {
    const r = resumoPorTanque(
      [
        dren({ tanque: "10", data: "2026-11-12" }),
        dren({ tanque: "2", data: "2026-10-01" }),
        dren({ tanque: "2", data: "2026-11-11", tem_agua: true }),
      ],
      HOJE,
    );
    expect(r.map((t) => t.tanque)).toEqual(["2", "10"]);
    expect(r[0]).toMatchObject({ ultima: "2026-11-11", total: 2, comAgua: 1, diasSemDrenar: 2 });
    expect(r[1]!.situacao).toBe("ok");
  });
  it("tanque sem drenar há mais de uma semana fica vencido", () => {
    const r = resumoPorTanque([dren({ data: "2026-10-20" })], HOJE);
    expect(r[0]).toMatchObject({ situacao: "vencido", diasSemDrenar: 24 });
  });
});

describe("agruparAfericoes", () => {
  it("agrupa por bomba e bico, com a mais recente primeiro no histórico", () => {
    const g = agruparAfericoes(
      [
        afer({ bomba: "2", bico: "7", data: "2026-10-01" }),
        afer({ bomba: "2", bico: "7", data: "2026-11-05", responsavel: "Beltrano" }),
        afer({ bomba: "1", bico: "3", data: "2026-10-01" }),
      ],
      HOJE,
    );
    expect(g.map((x) => x.chave)).toEqual(["1|3", "2|7"]);
    const b = g.find((x) => x.chave === "2|7")!;
    expect(b.historico.map((h) => h.data)).toEqual(["2026-11-05", "2026-10-01"]);
    expect(b).toMatchObject({
      ultima: "2026-11-05",
      responsavel: "Beltrano",
      proxima: "2026-11-20",
    });
  });
  it("ordena bombas e bicos como números, não como texto", () => {
    const g = agruparAfericoes(
      [
        afer({ bomba: "10", bico: "1" }),
        afer({ bomba: "2", bico: "10" }),
        afer({ bomba: "2", bico: "9" }),
      ],
      HOJE,
    );
    expect(g.map((x) => x.chave)).toEqual(["2|9", "2|10", "10|1"]);
  });
});

describe("pendências e litros", () => {
  it("conta vencidos e perto de vencer", () => {
    expect(contarPendentes(["ok", "vencido", "proximo", "ok"])).toBe(2);
  });
  it("formata litros no padrão brasileiro", () => {
    expect(formatarLitros(1234.5)).toBe("1.234,5 L");
    expect(formatarLitros(0)).toBe("0 L");
    expect(formatarLitros(null)).toBe("—");
  });
});
