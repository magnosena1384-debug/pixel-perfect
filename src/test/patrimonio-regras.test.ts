import { describe, expect, it } from "vitest";
import {
  CATEGORIAS,
  depreciacao,
  formatarTombamento,
  centavosDeTexto,
  mesesCompletos,
  resumoPatrimonio,
  vidaUtilSugerida,
} from "@/lib/patrimonio/regras";

const bem = (p: Partial<Parameters<typeof depreciacao>[0]> = {}) => ({
  valorCompra: 1_200_000, // R$ 12.000,00
  vidaUtilAnos: 10,
  dataCompra: "2026-01-15",
  baixaData: null,
  ...p,
});

describe("Patrimônio: depreciação em linha reta", () => {
  it("conta só os meses completos desde a compra", () => {
    expect(mesesCompletos("2026-01-15", "2026-10-14")).toBe(8);
    expect(mesesCompletos("2026-01-15", "2026-10-15")).toBe(9);
    expect(mesesCompletos("2026-01-15", "2026-01-10")).toBe(0);
  });

  it("R$ 12.000, 10 anos, comprado em 15/01/2026: R$ 11.200 em 14/10 e R$ 11.100 em 15/10", () => {
    expect(depreciacao(bem(), "2026-10-14")).toEqual({
      mensal: 10_000,
      meses: 8,
      acumulada: 80_000,
      atual: 1_120_000,
    });
    expect(depreciacao(bem(), "2026-10-15").atual).toBe(1_110_000);
  });

  it("nunca fica abaixo de zero", () => {
    const r = depreciacao(bem({ vidaUtilAnos: 5, dataCompra: "2019-10-01" }), "2026-10-20");
    expect(r.atual).toBe(0);
    expect(r.acumulada).toBe(1_200_000);
  });

  it("bem baixado para de depreciar na data da baixa", () => {
    const r = depreciacao(bem({ baixaData: "2026-03-15" }), "2026-10-20");
    expect(r.meses).toBe(2);
    expect(r.atual).toBe(1_180_000);
  });

  it("vida útil zero ou compra no futuro não deprecia", () => {
    expect(depreciacao(bem({ vidaUtilAnos: 0 }), "2026-10-20").atual).toBe(1_200_000);
    expect(depreciacao(bem({ dataCompra: "2027-01-01" }), "2026-10-20").atual).toBe(1_200_000);
  });
});

describe("Patrimônio: tombamento e categorias", () => {
  it("mostra o tombamento com 6 dígitos", () => {
    expect(formatarTombamento(123)).toBe("000123");
    expect(formatarTombamento(1234567)).toBe("1234567");
  });

  it("sugere a vida útil combinada para cada categoria", () => {
    expect(CATEGORIAS).toEqual([
      "Bombas e equipamentos de pista",
      "Máquinas e equipamentos",
      "Móveis e utensílios",
      "Informática",
      "Veículos",
      "Ferramentas",
      "Outros",
    ]);
    expect(CATEGORIAS.map(vidaUtilSugerida)).toEqual([10, 10, 10, 5, 5, 5, 10]);
  });
});

describe("Patrimônio: resumo de valores", () => {
  const b = (
    unidadeId: string,
    categoria: string,
    valorCompra: number,
    situacao = "em_uso",
    baixaData: string | null = null,
  ) => ({
    unidadeId,
    categoria,
    valorCompra,
    vidaUtilAnos: 10,
    dataCompra: "2026-01-15",
    situacao,
    baixaData,
  });

  it("soma compra, depreciação e valor atual por empresa e por categoria, sem os baixados", () => {
    const r = resumoPatrimonio(
      [
        b("u1", "Informática", 1_200_000),
        b("u1", "Móveis e utensílios", 120_000),
        b("u2", "Informática", 2_400_000),
        b("u2", "Informática", 999_999, "baixado", "2026-02-15"),
      ],
      "2026-10-15",
    );
    expect(r.total).toEqual({
      quantidade: 3,
      compra: 3_720_000,
      acumulada: 279_000,
      atual: 3_441_000,
    });
    expect(r.porEmpresa).toEqual([
      { chave: "u2", quantidade: 1, compra: 2_400_000, acumulada: 180_000, atual: 2_220_000 },
      { chave: "u1", quantidade: 2, compra: 1_320_000, acumulada: 99_000, atual: 1_221_000 },
    ]);
    expect(r.porCategoria.map((c) => [c.chave, c.quantidade])).toEqual([
      ["Informática", 2],
      ["Móveis e utensílios", 1],
    ]);
  });
});

describe("Patrimônio: valor em reais digitado", () => {
  it("aceita vírgula ou ponto como decimal e ponto de milhar", () => {
    expect(centavosDeTexto("1.500,50")).toBe(150_050);
    expect(centavosDeTexto("1500,50")).toBe(150_050);
    expect(centavosDeTexto("1500.50")).toBe(150_050);
    expect(centavosDeTexto("1500")).toBe(150_000);
    expect(centavosDeTexto("R$ 12.000,00")).toBe(1_200_000);
    expect(centavosDeTexto("1.500.000")).toBe(150_000_000);
  });

  it("recusa o que não é valor", () => {
    expect(centavosDeTexto("abc")).toBeNull();
    expect(centavosDeTexto("")).toBeNull();
    expect(centavosDeTexto("-5")).toBeNull();
  });
});
