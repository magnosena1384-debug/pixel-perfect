import { describe, expect, it } from "vitest";
import {
  agrupar,
  gerarExemplo,
  horaRegistro,
  numero,
  paraLancamentos,
  porCombustivel,
  porHora,
  totais,
  type RegistroImportado,
} from "@/lib/dashboard-vendas";

const reg = (
  endpoint: string,
  codigo: string,
  dados: Record<string, unknown>,
): RegistroImportado => ({
  endpoint,
  codigo,
  unidade_id: "u1",
  data_ref: "2026-10-16",
  dados,
});

describe("dashboard de vendas", () => {
  it("lê números e horas nos formatos do webPosto", () => {
    expect(numero("1.234,56")).toBe(1234.56);
    expect(numero("12.5")).toBe(12.5);
    expect(numero(7)).toBe(7);
    expect(numero("abc")).toBeNull();
    expect(horaRegistro({ dataHoraAbastecimento: "2026-10-16T07:45:00" })).toBe(7);
    expect(horaRegistro({ data: "2026-10-16", hora: "18:02" })).toBe(18);
    expect(horaRegistro({ data: "2026-10-16" })).toBeNull();
  });

  it("separa combustível e produtos sem contar o combustível duas vezes", () => {
    const lancs = paraLancamentos([
      reg("ABASTECIMENTO", "1", {
        dataHora: "2026-10-16T08:10:00",
        combustivelNome: "Gasolina comum",
        litros: 20,
        valorTotal: 123.8,
        frentistaNome: "Ana",
      }),
      reg("VENDA_ITEM", "10", {
        dataHora: "2026-10-16T08:12:00",
        produtoNome: "GASOLINA COMUM",
        valorTotal: 123.8,
        vendaCodigo: 500,
      }),
      reg("VENDA_ITEM", "11", {
        dataHora: "2026-10-16T08:12:00",
        produtoNome: "Água mineral",
        valorTotal: "3,50",
        vendaCodigo: 500,
        vendedorNome: "Ana",
      }),
    ]);
    expect(lancs).toHaveLength(2);
    expect(lancs.map((l) => l.categoria)).toEqual(["combustivel", "produto"]);
    expect(lancs[0]).toMatchObject({
      hora: 8,
      litros: 20,
      valorCentavos: 12380,
      colaborador: "Ana",
    });
  });

  it("usa o combustível de VENDA_ITEM quando não há abastecimentos", () => {
    const lancs = paraLancamentos([
      reg("VENDA_ITEM", "10", { produtoNome: "Diesel S10", valorTotal: 300, quantidade: 50 }),
    ]);
    expect(lancs[0]).toMatchObject({
      categoria: "combustivel",
      litros: 50,
      colaborador: "Não informado",
    });
  });

  it("calcula ticket médio pelo número de vendas, não de itens", () => {
    const lancs = paraLancamentos([
      reg("VENDA_ITEM", "1", {
        produtoNome: "Café",
        valorTotal: 7,
        vendaCodigo: 1,
        vendedorNome: "Bia",
      }),
      reg("VENDA_ITEM", "2", {
        produtoNome: "Salgado",
        valorTotal: 9,
        vendaCodigo: 1,
        vendedorNome: "Bia",
      }),
      reg("VENDA_ITEM", "3", {
        produtoNome: "Água",
        valorTotal: 4,
        vendaCodigo: 2,
        vendedorNome: "Caio",
      }),
    ]);
    expect(totais(lancs)).toMatchObject({ totalCentavos: 2000, cupons: 2, ticketCentavos: 1000 });
    const porColab = agrupar(lancs, (l) => l.colaborador);
    expect(porColab.map((g) => [g.chave, g.produto.ticketCentavos])).toEqual([
      ["Bia", 1600],
      ["Caio", 400],
    ]);
  });

  it("totaliza por hora e por tipo de combustível", () => {
    const lancs = paraLancamentos([
      reg("ABASTECIMENTO", "1", {
        dataHora: "2026-10-16T08:00:00",
        combustivelNome: "Etanol",
        litros: 10,
        valorTotal: 45.9,
      }),
      reg("ABASTECIMENTO", "2", {
        dataHora: "2026-10-16T08:30:00",
        combustivelNome: "Etanol",
        litros: 10,
        valorTotal: 45.9,
      }),
    ]);
    expect(porHora(lancs)[8]).toEqual({ hora: "08h", combustivel: 91.8, produto: 0 });
    expect(porCombustivel(lancs)[0]).toMatchObject({
      item: "Etanol",
      litros: 20,
      cupons: 2,
      precoLitroCentavos: 459,
    });
  });

  it("gera dados de exemplo iguais para o mesmo período", () => {
    const a = gerarExemplo(["u1", "u2"], "2026-10-10", "2026-10-11");
    expect(a.length).toBeGreaterThan(0);
    expect(gerarExemplo(["u1", "u2"], "2026-10-10", "2026-10-11")).toEqual(a);
    expect(new Set(a.map((l) => l.data))).toEqual(new Set(["2026-10-10", "2026-10-11"]));
  });
});
