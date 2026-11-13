import { describe, expect, it } from "vitest";
import {
  avisarDias,
  dataBr,
  diasEntre,
  montarDocumento,
  UNIDADE_DO_POSTO,
  type ItemPostoSeguro,
} from "@/lib/regulacao-importacao";

const item = (p: Partial<ItemPostoSeguro> = {}): ItemPostoSeguro => ({
  id: "abc123",
  posto_id: "1676378412277x474270687898632200",
  tipo: "documento",
  orgao: "Corpo de Bombeiros",
  nome: "AVCB – Auto de vistoria do Corpo de Bombeiros",
  validade: "2027-03-03",
  prazo_limite: "",
  avisar_dias: 60,
  arquivo_nome: "avcb.pdf",
  ...p,
});

describe("datas da importação", () => {
  it("conta dias entre datas atravessando meses e anos", () => {
    expect(diasEntre("2027-11-23", "2028-03-22")).toBe(120);
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(diasEntre("2027-01-06", "2027-01-06")).toBe(0);
  });
  it("mostra a data no formato brasileiro", () => {
    expect(dataBr("2027-11-23")).toBe("23/11/2027");
  });
});

describe("avisarDias", () => {
  it("sem prazo limite, é o aviso do Posto Seguro", () => {
    expect(avisarDias("2027-03-03", "", 60)).toBe(60);
  });
  it("com prazo limite anterior, soma a folga até a validade", () => {
    // validade 22/03/2028, prazo limite 23/11/2027 (120 dias antes), avisa 60 dias antes do prazo
    expect(avisarDias("2028-03-22", "2027-11-23", 60)).toBe(180);
  });
  it("prazo limite depois da validade não reduz o aviso", () => {
    expect(avisarDias("2027-01-01", "2027-02-01", 30)).toBe(30);
  });
  it("aviso inválido cai para 30", () => {
    expect(avisarDias("2027-01-01", "", Number.NaN)).toBe(30);
  });
});

describe("montarDocumento", () => {
  it("monta o documento da Regulação com id próprio e campos vazios quando não há dado", () => {
    expect(montarDocumento(item())).toEqual({
      id: "ps-abc123",
      orgao: "Corpo de Bombeiros",
      nome: "AVCB – Auto de vistoria do Corpo de Bombeiros",
      numero: "",
      emissao: "",
      validade: "2027-03-03",
      avisar_dias: 60,
      obs: "Importado do Posto Seguro",
    });
  });
  it("anota na observação o prazo para renovar quando ele existe", () => {
    const d = montarDocumento(item({ validade: "2028-03-22", prazo_limite: "2027-11-23" }));
    expect(d.obs).toBe("Importado do Posto Seguro · prazo para renovar: 23/11/2027");
    expect(d.avisar_dias).toBe(180);
  });
});

describe("postos", () => {
  it("os 9 postos do Posto Seguro apontam para unidades diferentes", () => {
    const nomes = Object.values(UNIDADE_DO_POSTO);
    expect(nomes).toHaveLength(9);
    expect(new Set(nomes).size).toBe(9);
  });
});
