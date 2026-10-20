import { describe, expect, it } from "vitest";
import { avisoDaLeitura, lerNumero, resumoInventario } from "@/lib/patrimonio/inventario";

describe("Patrimônio: número lido da etiqueta", () => {
  it("aceita o QR, o número com ou sem zeros e espaços", () => {
    expect(lerNumero("000123")).toBe(123);
    expect(lerNumero("123")).toBe(123);
    expect(lerNumero(" 123 ")).toBe(123);
    expect(lerNumero("000123\n")).toBe(123); // leitor USB costuma mandar Enter no fim
  });

  it("recusa o que não é um tombamento", () => {
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("12a")).toBeNull();
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("000000")).toBeNull();
  });
});

describe("Patrimônio: resultado de cada leitura", () => {
  it("diz o que aconteceu e a cor do cartão", () => {
    const bem = { tombamento: 123, nome: "Bomba 3", empresa: "Posto Lemon II" };
    expect(avisoDaLeitura({ status: "encontrado", bem })).toMatchObject({
      tom: "certo",
      titulo: "000123 · Bomba 3",
    });
    expect(avisoDaLeitura({ status: "ja_lido", bem })).toMatchObject({ tom: "atencao" });
    // Bem de outra empresa: o banco devolve só o número e a empresa, sem o nome.
    expect(
      avisoDaLeitura({
        status: "outra_empresa",
        bem: { tombamento: 45, empresa: "Posto Lemon II" },
      }),
    ).toEqual({
      tom: "atencao",
      titulo: "000045",
      texto: "Este bem é de Posto Lemon II. Não conta neste inventário.",
    });
    expect(avisoDaLeitura({ status: "em_transito", bem })).toMatchObject({ tom: "atencao" });
    expect(avisoDaLeitura({ status: "baixado", bem })).toMatchObject({ tom: "erro" });
    expect(avisoDaLeitura({ status: "nao_existe", numero: 999 })).toMatchObject({
      tom: "erro",
      titulo: "000999",
    });
  });
});

describe("Patrimônio: contas do inventário", () => {
  const bens = [
    { id: "a", situacao: "em_uso" as const },
    { id: "b", situacao: "com_defeito" as const },
    { id: "c", situacao: "em_uso" as const },
    { id: "d", situacao: "baixado" as const },
    { id: "e", situacao: "em_transito" as const },
  ];

  it("conta só os bens que deviam estar na empresa e lista os não encontrados", () => {
    const r = resumoInventario(bens, [
      { bemId: "a", comDefeito: false, foraDaEmpresa: false },
      { bemId: "b", comDefeito: true, foraDaEmpresa: false },
      { bemId: "x", comDefeito: false, foraDaEmpresa: true },
    ]);
    expect(r).toEqual({
      esperados: 3,
      encontrados: 2,
      naoEncontrados: ["c"],
      comDefeito: 1,
      foraDaEmpresa: 1,
    });
  });
});
