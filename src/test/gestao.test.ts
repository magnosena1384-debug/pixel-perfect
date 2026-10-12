import { describe, expect, it } from "vitest";
import {
  addDias,
  calcularAlertas,
  diasAte,
  situacao,
  type Documento,
  type ItemManutencao,
  type Rotina,
} from "@/lib/gestao";

const base = "2026-10-10";

const doc = (validade: string): Documento => ({
  id: validade,
  orgao: "Corpo de Bombeiros",
  nome: "AVCB",
  numero: "",
  emissao: "",
  validade,
  avisar_dias: 30,
  obs: "",
});

describe("gestão: vencimentos", () => {
  it("calcula datas sem erro de fuso", () => {
    expect(addDias("2026-02-27", 2)).toBe("2026-03-01");
    expect(diasAte("2026-10-11", base)).toBe(1);
  });

  it("classifica situação pela antecedência", () => {
    expect(situacao("2026-10-09", 30, base)).toBe("vencido");
    expect(situacao("2026-10-10", 30, base)).toBe("proximo");
    expect(situacao("2026-11-09", 30, base)).toBe("proximo");
    expect(situacao("2026-11-10", 30, base)).toBe("ok");
    expect(situacao(null, 30, base)).toBe("sem-data");
  });

  it("lista só vencidos e a vencer, pendentes e vencidos primeiro", () => {
    const itens: ItemManutencao[] = [
      { id: "nunca", categoria: "Filtros", nome: "Filtro", periodicidade_dias: 90, historico: [] },
      {
        id: "em-dia",
        categoria: "Bombas",
        nome: "Aferição",
        periodicidade_dias: 30,
        historico: [{ data: base, resultado: "ok", responsavel: "", obs: "" }],
      },
    ];
    const rotinas: Rotina[] = [
      { id: "caixa", titulo: "Caixa", frequencia_dias: 1, responsavel: "", ultima_execucao: base },
    ];
    const alertas = calcularAlertas(
      [doc("2026-10-20"), doc("2027-06-01"), doc("2026-10-01")],
      itens,
      rotinas,
      base,
    );
    expect(alertas.map((a) => a.id)).toEqual(["nunca", "2026-10-01", "2026-10-20"]);
  });
});
