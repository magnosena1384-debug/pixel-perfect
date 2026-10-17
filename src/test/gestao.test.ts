import {
  addDias,
  agruparCelulas,
  calcularAlertas,
  celulasDeLancamentos,
  diasAte,
  diferencas,
  porProduto,
  resumo,
  SEM_COLABORADOR,
  situacao,
  tipoProduto,
  uid,
  vendasPorHora,
  type Celula,
  type Documento,
  type ItemManutencao,
  type Rotina,
  type VendaDaUnidade,
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

describe("gestão: indicadores de vendas", () => {
  const venda = (p: Partial<VendaDaUnidade> & { produto: string; valor_centavos: number }) => ({
    id: Math.random().toString(),
    data: base,
    litros: null,
    pagamento: "PIX",
    obs: "",
    unidade: "Centro",
    ...p,
  });

  const lancamentos = celulasDeLancamentos([
    venda({
      produto: "Etanol",
      valor_centavos: 10000,
      litros: 25,
      hora: "08:15",
      colaborador: "Ana",
    }),
    venda({
      produto: "Diesel S10",
      valor_centavos: 30000,
      litros: 50,
      hora: "08:40",
      colaborador: "Bia",
    }),
    venda({ produto: "Conveniência", valor_centavos: 1500, hora: "09:05", colaborador: "Ana" }),
    venda({
      produto: "Lubrificantes",
      valor_centavos: 4500,
      hora: "23:59",
      colaborador: "Ana",
      unidade: "BR-101",
    }),
    venda({ produto: "Gasolina comum", valor_centavos: 20000, litros: 33 }),
  ]);

  it("separa combustível de produtos", () => {
    expect(tipoProduto("GNV")).toBe("combustivel");
    expect(tipoProduto("Conveniência")).toBe("produtos");
  });

  it("calcula total, litros e ticket médio de lançamentos manuais", () => {
    expect(resumo(lancamentos)).toEqual({ vendas: 5, total: 66000, litros: 108, ticket: 13200 });
    expect(resumo(lancamentos, "combustivel").ticket).toBe(20000);
    expect(resumo(lancamentos, "produtos")).toMatchObject({ vendas: 2, ticket: 3000 });
    expect(resumo([]).ticket).toBe(0);
  });

  it("agrupa por colaborador e unidade, ordenando pelo faturamento", () => {
    const grupos = agruparCelulas(lancamentos, "colaborador");
    expect(grupos.map((g) => g.nome)).toEqual(["Bia", SEM_COLABORADOR, "Ana"]);
    const ana = grupos.find((g) => g.nome === "Ana")!;
    expect(ana.combustivel.ticket).toBe(10000);
    expect(ana.produtos.ticket).toBe(3000);
    expect(ana.geral.ticket).toBe(5333);
    expect(agruparCelulas(lancamentos, "unidade").map((g) => g.nome)).toEqual(["Centro", "BR-101"]);
  });

  it("conta o cupom misto uma vez no geral e uma vez em cada tipo", () => {
    // Formato devolvido pelo banco: um cupom de R$ 150 com gasolina (R$ 120) e água (R$ 30).
    const cel = (
      nivel: Celula["nivel"],
      tipo: Celula["tipo"],
      produto: string | null,
      total: number,
      litros = 0,
    ): Celula => ({
      nivel,
      tipo,
      produto,
      total,
      litros,
      vendas: 1,
      unidade: "Centro",
      colaborador: "Ana",
      hora: 7,
    });
    const cupom = [
      cel("geral", null, null, 15000, 20),
      cel("tipo", "combustivel", null, 12000, 20),
      cel("tipo", "produtos", null, 3000),
      cel("produto", "combustivel", "GASOLINA COMUM", 12000, 20),
      cel("produto", "produtos", "AGUA 500ML", 3000),
    ];
    expect(resumo(cupom)).toMatchObject({ vendas: 1, ticket: 15000 });
    expect(resumo(cupom, "combustivel").ticket).toBe(12000);
    expect(porProduto(cupom, "combustivel")).toEqual([
      { nome: "GASOLINA COMUM", resumo: { vendas: 1, total: 12000, litros: 20, ticket: 12000 } },
    ]);
    expect(vendasPorHora(cupom)[7]).toEqual({ hora: 7, combustivel: 12000, produtos: 3000 });
  });

  it("soma por hora e ignora vendas sem hora", () => {
    const horas = vendasPorHora(lancamentos);
    expect(horas).toHaveLength(24);
    expect(horas[8]).toEqual({ hora: 8, combustivel: 40000, produtos: 0 });
    expect(horas[9]!.produtos).toBe(1500);
    expect(horas[23]!.produtos).toBe(4500);
    expect(horas.reduce((s, h) => s + h.combustivel + h.produtos, 0)).toBe(46000);
  });
});

describe("gestão: gravação no banco", () => {
  it("grava só o que mudou e apaga o que saiu da lista", () => {
    const antes = [
      { id: "a", v: 1 },
      { id: "b", v: 1 },
      { id: "c", v: 1 },
    ];
    const depois = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "d", v: 1 },
    ];
    const { gravar, apagar } = diferencas(antes, depois);
    expect(gravar.map((i) => i.id)).toEqual(["b", "d"]);
    expect(apagar).toEqual(["c"]);
  });

  it("ids novos ficam em ordem de criação", () => {
    const ids = Array.from({ length: 50 }, () => uid());
    expect([...ids].sort()).toEqual(ids);
  });
});
