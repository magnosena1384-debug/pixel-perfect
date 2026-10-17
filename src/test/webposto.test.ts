import { describe, expect, it } from "vitest";
import {
  chaveRegistro,
  dataRegistro,
  empresaRegistro,
  extrairLista,
  proximoCodigo,
} from "@/lib/webposto";

describe("webPosto: leitura das respostas", () => {
  it("aceita lista direta ou objeto com a lista dentro", () => {
    expect(extrairLista([{ codigo: 1 }])).toHaveLength(1);
    expect(
      extrairLista({ ultimoCodigo: 5, resultados: [{ codigo: 1 }, { codigo: 2 }] }),
    ).toHaveLength(2);
    expect(extrairLista(null)).toEqual([]);
  });

  it("identifica o código do registro sem confundir com o da empresa", () => {
    expect(chaveRegistro({ codigo: 10, empresaCodigo: 3 }, "VENDA")).toBe("10");
    expect(chaveRegistro({ empresaCodigo: 3, abastecimentoCodigo: 77 }, "ABASTECIMENTO")).toBe(
      "77",
    );
    expect(chaveRegistro({ empresaCodigo: 3, vendaItemCodigo: 9 }, "VENDA_ITEM")).toBe("9");
  });

  it("lê data e empresa", () => {
    expect(dataRegistro({ empresaCodigo: 1, dataMovimento: "2026-10-13T08:00:00" })).toBe(
      "2026-10-13",
    );
    expect(dataRegistro({ total: 5 })).toBeNull();
    expect(empresaRegistro({ empresaCodigo: "12" })).toBe(12);
  });

  it("avança a paginação pelo ultimoCodigo da API ou pelo maior código", () => {
    expect(proximoCodigo({ ultimoCodigo: 50, resultados: [] }, [], "VENDA", 0)).toBe(50);
    expect(proximoCodigo([], [{ codigo: 3 }, { codigo: 9 }], "VENDA", 0)).toBe(9);
  });
});
