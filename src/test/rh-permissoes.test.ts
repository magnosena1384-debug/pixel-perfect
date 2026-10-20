import { describe, expect, it } from "vitest";
import { PERMISSOES, permissoesDe } from "@/lib/gestao";

describe("RH: permissões por unidade", () => {
  it("aparecem em Acessos ao lado dos módulos da gestão", () => {
    expect(PERMISSOES.map((p) => p.id)).toEqual([
      "vendas",
      "rotinas",
      "pedidos",
      "documentos",
      "manutencao",
      "rh",
      "rh-importar",
    ]);
  });

  it("o admin tem todas, inclusive as do RH", () => {
    expect([...permissoesDe(true, [])]).toEqual(PERMISSOES.map((p) => p.id));
  });

  it("quem pode importar também vê o painel de RH", () => {
    expect(permissoesDe(false, ["rh-importar"]).has("rh")).toBe(true);
  });

  it("ignora o que não é permissão conhecida e não dá RH a quem só tem vendas", () => {
    const p = permissoesDe(false, ["vendas", "qualquer"]);
    expect([...p]).toEqual(["vendas"]);
  });
});
