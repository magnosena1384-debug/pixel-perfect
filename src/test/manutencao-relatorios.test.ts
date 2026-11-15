import { describe, expect, it } from "vitest";
import { escapar, relatorioAfericaoHtml, relatorioDrenagemHtml } from "@/lib/manutencao-relatorios";
import type { Afericao, Drenagem } from "@/lib/manutencao-regras";

const drenagem = (p: Partial<Drenagem> = {}): Drenagem => ({
  id: "d1",
  data: "2026-11-13",
  tanque: "1",
  produto: "Diesel S-10",
  capacidade_litros: 15000,
  volume_amostra_litros: 2.5,
  volume_agua_litros: 0,
  tem_agua: false,
  aspecto_normal: true,
  agua_no_medidor: false,
  cor: "Amarelo",
  medida_adotada: null,
  responsavel: "Fulano de Tal",
  rg_responsavel: "1234567",
  origem_id: null,
  ...p,
});

const afericao = (p: Partial<Afericao> = {}): Afericao => ({
  id: "a1",
  data: "2026-10-26",
  bomba: "2",
  bico: "7",
  produto: "Gasolina Comum",
  responsavel: "Beltrano",
  obs: null,
  origem_id: null,
  realizada_em: null,
  vazao_alta_ml: null,
  vazao_baixa_ml: null,
  ...p,
});

describe("escapar", () => {
  it("troca os caracteres que viram marcação", () => {
    expect(escapar(`<script>alert("x")</script> & 'a'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;a&#39;",
    );
    expect(escapar(null)).toBe("");
  });
});

describe("relatório de drenagem", () => {
  it("traz o posto, a data e as respostas do formulário", () => {
    const h = relatorioDrenagemHtml(drenagem(), "Posto Lemon I - Satélite", "2026-11-15");
    expect(h).toContain("Relatório de drenagem de tanque");
    expect(h).toContain("Posto Lemon I - Satélite");
    expect(h).toContain("13/11/2026");
    expect(h).toContain("Diesel S-10");
    expect(h).toContain("2,5 L");
    expect(h).toContain("Fulano de Tal");
    expect(h).toContain("1234567");
    expect(h).toContain("Emitido em 15/11/2026");
    expect(h).toContain("Assinatura do responsável pela análise");
    expect(h).not.toContain("Visto da gerência");
  });
  it("mostra Sim e Não e traço para o que não foi informado", () => {
    const h = relatorioDrenagemHtml(
      drenagem({ tem_agua: true, aspecto_normal: false, medida_adotada: null, cor: "  " }),
      "Posto X",
    );
    expect(h).toMatch(/Presença de água\?<\/th><td>Sim</);
    expect(h).toMatch(/isento de material particulado\?<\/th><td>Não</);
    expect(h).toMatch(/Medida adotada<\/th><td>—</);
    expect(h).toMatch(/Cor<\/th><td>—</);
  });
  it("nada do que vem do banco vira marcação", () => {
    const h = relatorioDrenagemHtml(
      drenagem({ responsavel: "<img src=x onerror=alert(1)>", cor: "</td><script>x()</script>" }),
      "Posto <b>X</b>",
    );
    expect(h).not.toContain("<img src=x");
    expect(h).not.toContain("<script>x()");
    expect(h).not.toContain("<b>X</b>");
    expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("avisa quando o lançamento veio do Posto Seguro", () => {
    expect(relatorioDrenagemHtml(drenagem({ origem_id: "123" }), "Posto X")).toContain(
      "importado do Posto Seguro",
    );
    expect(relatorioDrenagemHtml(drenagem(), "Posto X")).not.toContain("importado do Posto Seguro");
  });
});

describe("relatório de aferição", () => {
  it("traz bomba, bico, produto e a próxima aferição (15 dias depois)", () => {
    const h = relatorioAfericaoHtml(afericao(), "Posto Lemon II - Neópolis", "2026-11-15");
    expect(h).toContain("Relatório de aferição de bomba e bico");
    expect(h).toContain("26/10/2026");
    expect(h).toMatch(/Bomba<\/th><td>2</);
    expect(h).toMatch(/Bico<\/th><td>7</);
    expect(h).toContain("Gasolina Comum");
    expect(h).toContain("10/11/2026");
    expect(h).toContain("Assinatura do responsável pela aferição");
    expect(h).not.toContain("Visto da gerência");
  });
  it("explica que respostas e vazão ficam no Posto Seguro quando importada", () => {
    expect(relatorioAfericaoHtml(afericao({ origem_id: "9" }), "Posto X")).toContain(
      "as respostas do questionário ficam lá",
    );
  });
});

describe("relatório de aferição: vazão e hora", () => {
  const completa = afericao({
    realizada_em: "2026-10-26T14:30:00.000Z",
    vazao_alta_ml: -20,
    vazao_baixa_ml: -40,
  });
  it("mostra hora, as duas vazões e o resultado aprovado", () => {
    const h = relatorioAfericaoHtml(completa, "Posto X", "2026-11-15");
    expect(h).toMatch(/Hora da aferição<\/th><td>11:30</);
    expect(h).toContain("Vazão alta (tolerância ± 100 ml)");
    expect(h).toContain("−20 ml (dentro da tolerância)");
    expect(h).toContain("−40 ml (dentro da tolerância)");
    expect(h).toMatch(/Resultado da aferição<\/th><td>APROVADO/);
  });
  it("reprova quando uma vazão passa de 100 ml", () => {
    const h = relatorioAfericaoHtml(
      afericao({ vazao_alta_ml: 150, vazao_baixa_ml: 20 }),
      "Posto X",
    );
    expect(h).toContain("+150 ml (fora da tolerância)");
    expect(h).toMatch(/Resultado da aferição<\/th><td>REPROVADO/);
  });
  it("sem vazão informada, diz que não foi informado (sem inventar resultado)", () => {
    const h = relatorioAfericaoHtml(afericao(), "Posto X");
    expect(h).toMatch(/Vazão alta[^<]*<\/th><td>Não informado</);
    expect(h).toMatch(/Resultado da aferição<\/th><td>Não informado</);
    expect(h).toMatch(/Hora da aferição<\/th><td>—</);
  });
});
