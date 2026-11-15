import { describe, expect, it } from "vitest";
import { dataDoCartao, lerFolhasAfericao } from "@/lib/postoseguro-leitura";

const ESCALAS = "200\n100\n0\n-100\n-200\n VA\nZÃ\nO   \n AL\nTA \n+\n-\n";

/** Como o site escreve: positivos com "+", zero sem sinal, negativos com "-". */
const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Um bico como o site entrega o texto. Sem `par`, o bico aparece sem o ALTA/BAIXA. */
const bico = (n: number, par?: [number, number]) =>
  `Prod.: Etanol\nNúm. do Bico: ${n}\nResp.: Chefe de Pista\n${ESCALAS}${ESCALAS}` +
  (par ? `ALTA: ${sinal(par[0])}\nBAIXA: ${sinal(par[1])}\nAprovado\n` : "");

const folha = (data: string, ...bicos: string[]) =>
  `AFERIÇÃO BOMBAS\n${bicos.join("")}Elaborado por:      Chefe de Pista        \nData:      ${data}      \nAssinatura:\n`;

describe("lerFolhasAfericao", () => {
  it("lê o par de cada bico e a data impressa na folha", () => {
    const texto =
      folha("27/04/2026", bico(1, [-20, 0]), bico(2, [-20, -20]), bico(3, [-80, -40])) +
      folha("27/04/2026", bico(4, [20, -20]), bico(5, [0, 0]));
    expect(lerFolhasAfericao(texto)).toEqual([
      { data: "2026-04-27", bico: 1, alta: -20, baixa: 0 },
      { data: "2026-04-27", bico: 2, alta: -20, baixa: -20 },
      { data: "2026-04-27", bico: 3, alta: -80, baixa: -40 },
      { data: "2026-04-27", bico: 4, alta: 20, baixa: -20 },
      { data: "2026-04-27", bico: 5, alta: 0, baixa: 0 },
    ]);
  });
  it("usa a data de cada folha, mesmo quando a tela mostra relatórios de dias diferentes", () => {
    const texto = folha("22/06/2026", bico(1, [0, 0])) + folha("27/04/2026", bico(1, [-20, 0]));
    expect(lerFolhasAfericao(texto)).toEqual([
      { data: "2026-06-22", bico: 1, alta: 0, baixa: 0 },
      { data: "2026-04-27", bico: 1, alta: -20, baixa: 0 },
    ]);
  });
  it("folha sem data é ignorada (não dá para saber de que dia é)", () => {
    const sem = `AFERIÇÃO BOMBAS\n${bico(1, [0, 0])}Elaborado por: X\nAssinatura:\n`;
    expect(lerFolhasAfericao(sem)).toEqual([]);
  });
  it("bico sem o par no texto fica de fora, e o par seguinte NÃO é dele", () => {
    const texto = folha("27/04/2026", bico(1, [-20, 0]), bico(2), bico(3, [-80, -40]), bico(4));
    expect(lerFolhasAfericao(texto).map((l) => [l.bico, l.alta, l.baixa])).toEqual([
      [1, -20, 0],
      [3, -80, -40],
    ]);
  });
  it("o último bico de uma folha sem par não pega o par da folha seguinte", () => {
    const texto =
      folha("27/04/2026", bico(1, [0, 0]), bico(2)) + folha("27/04/2026", bico(3, [40, 20]));
    expect(lerFolhasAfericao(texto).map((l) => [l.bico, l.alta, l.baixa])).toEqual([
      [1, 0, 0],
      [3, 40, 20],
    ]);
  });
  it("lê os positivos escritos com o sinal de mais (ALTA: +20 BAIXA: +40)", () => {
    const texto = folha("27/04/2026", bico(8, [20, 20]), bico(10, [40, -20]), bico(11, [20, 0]));
    expect(lerFolhasAfericao(texto).map((l) => [l.bico, l.alta, l.baixa])).toEqual([
      [8, 20, 20],
      [10, 40, -20],
      [11, 20, 0],
    ]);
  });
  it("lê o texto exato do site, colado, com o sinal de mais e a data", () => {
    const colado =
      "AFERIÇÃO BOMBASProd.: EtanolNúm. do Bico: 6Resp.: Chefe de Pista2001000-100-200 VAZÃO ALTA +-" +
      "2001000-100-200 VAZÃO BAIXA+-ALTA: +20BAIXA: -20AprovadoProd.: EtanolNúm. do Bico: 7Resp.: Chefe de Pista" +
      "2001000-100-200 VAZÃO ALTA +-2001000-100-200 VAZÃO BAIXA+-ALTA: -20BAIXA: -40Aprovado" +
      "Elaborado por:      Chefe de Pista    Data:                  27/04/2026     Assinatura:";
    expect(lerFolhasAfericao(colado)).toEqual([
      { data: "2026-04-27", bico: 6, alta: 20, baixa: -20 },
      { data: "2026-04-27", bico: 7, alta: -20, baixa: -40 },
    ]);
  });
  it("lê valores negativos e o limite de 100", () => {
    expect(lerFolhasAfericao(folha("13/10/2026", bico(12, [-100, 100])))).toEqual([
      { data: "2026-10-13", bico: 12, alta: -100, baixa: 100 },
    ]);
  });
  it("devolve vazio quando não há folha", () => {
    expect(lerFolhasAfericao("Histórico das Aferições\nData: 13/10/26")).toEqual([]);
  });
});

describe("dataDoCartao", () => {
  it("converte a data do cartão da rotina", () => {
    expect(dataDoCartao("Rotina de Aferição Simplificada\nData: 03/09/26\nBicos: 1")).toBe(
      "2026-09-03",
    );
    expect(dataDoCartao("sem data")).toBeNull();
  });
});
