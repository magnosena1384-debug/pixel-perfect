import { describe, expect, it } from "vitest";
import {
  chaveRegistro,
  caminhoEndpoint,
  codigoGravado,
  itemCompacto,
  lerChaves,
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

describe("várias chaves", () => {
  it("lê chaves separadas por vírgula, espaço ou linha, sem repetir", () => {
    expect(lerChaves(" a, b\nc ;a ")).toEqual(["a", "b", "c"]);
    expect(lerChaves(undefined)).toEqual([]);
  });
  it("o código gravado leva o posto, para dois postos não se sobrescreverem", () => {
    expect(codigoGravado({ codigo: 7 }, "VENDAS", 1)).toBe("1:7");
    expect(codigoGravado({ codigo: 7 }, "VENDAS", 2)).toBe("2:7");
  });
});

describe("itens das vendas", () => {
  it("usa o caminho VENDAS/ITENS só para os itens", () => {
    expect(caminhoEndpoint("VENDAS_ITENS")).toBe("VENDAS/ITENS");
    expect(caminhoEndpoint("VENDAS")).toBe("VENDAS");
  });
  it("reduz o item ao que o painel usa; combustível é o que tem bico", () => {
    const item = itemCompacto(
      {
        empresaCodigo: 1758,
        vendaCodigo: 10,
        vendaItemCodigo: 99,
        dataMovimento: "2026-10-21",
        produtoDescricao: " GASOLINA ADITIVADA ",
        bicoCodigo: 5,
        quantidade: 2.55,
        totalVenda: 16.29,
      },
      "u1",
    );
    expect(item).toMatchObject({
      empresa_codigo: 1758,
      item_codigo: 99,
      venda_codigo: 10,
      unidade_id: "u1",
      data_ref: "2026-10-21",
      produto: "GASOLINA ADITIVADA",
      bico: true,
      quantidade: 2.55,
      total: 16.29,
    });
    expect(
      itemCompacto(
        {
          empresaCodigo: 1,
          vendaCodigo: 1,
          vendaItemCodigo: 2,
          dataMovimento: "2026-10-21",
          produtoCodigo: 7,
        },
        null,
      ),
    ).toMatchObject({ bico: false, produto: "Produto 7" });
  });
  it("descarta item sem identificação", () => {
    expect(itemCompacto({ empresaCodigo: 1, dataMovimento: "2026-10-21" }, null)).toBeNull();
  });
});
