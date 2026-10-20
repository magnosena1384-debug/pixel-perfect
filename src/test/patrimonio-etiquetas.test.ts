import { describe, expect, it } from "vitest";
import { FORMATOS, paginasDeEtiquetas } from "@/lib/patrimonio/etiquetas";

const bens = Array.from({ length: 31 }, (_, i) => ({
  tombamento: i + 1,
  nome: `Bem ${i + 1}`,
  empresa: "Posto Lemon I - Satélite",
}));

describe("Patrimônio: etiquetas", () => {
  it("Pimaco 6180: 30 por folha Carta, 66,7 × 25,4 mm, 3 colunas e 10 linhas", () => {
    expect(FORMATOS["pimaco-6180"]).toMatchObject({ pagina: { largura: 215.9, altura: 279.4 } });
    const paginas = paginasDeEtiquetas(bens, "pimaco-6180");
    expect(paginas.map((p) => p.etiquetas.length)).toEqual([30, 1]);
    const [a, b, , d] = paginas[0]!.etiquetas;
    expect(a).toMatchObject({ x: 4.76, y: 12.7, largura: 66.7, altura: 25.4 });
    expect(b).toMatchObject({ x: 74.61, y: 12.7 });
    expect(d).toMatchObject({ x: 4.76, y: 38.1 });
    expect(paginas[0]!.etiquetas.at(-1)).toMatchObject({ x: 144.46, y: 241.3 });
  });

  it("térmica: uma etiqueta de 50 × 30 mm por página", () => {
    const paginas = paginasDeEtiquetas(bens.slice(0, 3), "termica-50x30");
    expect(paginas).toHaveLength(3);
    expect(paginas[0]).toMatchObject({ largura: 50, altura: 30 });
    expect(paginas[0]!.etiquetas).toEqual([
      expect.objectContaining({ x: 0, y: 0, largura: 50, altura: 30 }),
    ]);
  });

  it("cada etiqueta traz o QR com o tombamento, o número, o nome e a empresa", () => {
    const [etiqueta] = paginasDeEtiquetas(
      [{ tombamento: 123, nome: "Bomba 3", empresa: "Posto Lemon II" }],
      "termica-50x30",
    )[0]!.etiquetas;
    expect(etiqueta).toMatchObject({
      qr: "000123",
      numero: "000123",
      nome: "Bomba 3",
      empresa: "Posto Lemon II",
    });
  });

  it("sem bens, não há páginas", () => {
    expect(paginasDeEtiquetas([], "pimaco-6180")).toEqual([]);
  });
});
