import { describe, expect, it } from "vitest";
import type { Evidencia, Rotina } from "@/lib/gestao";
import {
  caminhoDaEvidencia,
  caminhosDeEvidencias,
  dimensoesReduzidas,
  LADO_MAXIMO,
  MAX_EXECUCOES,
  MAX_FOTOS,
  MAX_ORIGINAL_BYTES,
  registrarExecucao,
  vagasDeFotos,
  validarImagem,
} from "@/lib/evidencias-regras";

const rotina = (p: Partial<Rotina> = {}): Rotina => ({
  id: "r1",
  titulo: "Conferir extintores",
  frequencia_dias: 30,
  responsavel: "Fulano",
  ultima_execucao: null,
  ...p,
});

const evid = (n: string): Evidencia => ({
  caminho: `u/rotinas/${n}.jpg`,
  nome: `${n}.jpg`,
  em: "2026-11-15T10:00:00.000Z",
});

describe("validarImagem", () => {
  it("aceita foto de celular em JPG, PNG, WebP e HEIC", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"])
      expect(validarImagem({ type, size: 4_000_000 })).toBeNull();
  });
  it("recusa o que não é imagem, arquivo vazio e foto grande demais", () => {
    expect(validarImagem({ type: "application/pdf", size: 1000 })).toMatch(/foto/);
    expect(validarImagem({ type: "image/jpeg", size: 0 })).toMatch(/vazia/);
    expect(validarImagem({ type: "image/jpeg", size: MAX_ORIGINAL_BYTES + 1 })).toMatch(/30 MB/);
  });
});

describe("vagasDeFotos", () => {
  it("conta quantas ainda cabem e nunca fica negativo", () => {
    expect(vagasDeFotos(0)).toBe(MAX_FOTOS);
    expect(vagasDeFotos(4)).toBe(MAX_FOTOS - 4);
    expect(vagasDeFotos(MAX_FOTOS + 3)).toBe(0);
  });
});

describe("caminhoDaEvidencia", () => {
  it("começa pela unidade e pelo módulo, que são o que dá acesso", () => {
    const c = caminhoDaEvidencia("u-1", "rotinas", 1000, "ab12");
    expect(c.startsWith("u-1/rotinas/")).toBe(true);
    expect(c.endsWith("-ab12.jpg")).toBe(true);
    expect(caminhoDaEvidencia("u-1", "manutencao", 1000, "ab12")).toContain("/manutencao/");
  });
  it("fotos tiradas em horas ou com sufixos diferentes têm caminhos diferentes", () => {
    expect(caminhoDaEvidencia("u", "rotinas", 1, "a")).not.toBe(
      caminhoDaEvidencia("u", "rotinas", 2, "a"),
    );
    expect(caminhoDaEvidencia("u", "rotinas", 1, "a")).not.toBe(
      caminhoDaEvidencia("u", "rotinas", 1, "b"),
    );
  });
});

describe("dimensoesReduzidas", () => {
  it("reduz o maior lado para 1600 mantendo a proporção", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: LADO_MAXIMO, altura: 1200 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: LADO_MAXIMO });
  });
  it("não amplia foto pequena", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesReduzidas(1600, 900)).toEqual({ largura: 1600, altura: 900 });
  });
});

describe("caminhosDeEvidencias", () => {
  it("junta os caminhos de várias listas, ignorando as que não existem", () => {
    expect(caminhosDeEvidencias([evid("a"), evid("b")], undefined, [evid("c")])).toEqual([
      "u/rotinas/a.jpg",
      "u/rotinas/b.jpg",
      "u/rotinas/c.jpg",
    ]);
    expect(caminhosDeEvidencias()).toEqual([]);
  });
});

describe("registrarExecucao", () => {
  it("entra no início do histórico e vira a última execução", () => {
    const r = registrarExecucao(rotina({ ultima_execucao: "2026-10-01" }), {
      data: "2026-11-10",
      obs: "tudo certo",
      evidencias: [evid("a")],
    });
    expect(r.ultima_execucao).toBe("2026-11-10");
    expect(r.execucoes).toHaveLength(1);
    expect(r.execucoes![0]).toMatchObject({ data: "2026-11-10", obs: "tudo certo" });
  });
  it("registrar uma execução antiga não volta a data da última", () => {
    const r = registrarExecucao(rotina({ ultima_execucao: "2026-11-10" }), {
      data: "2026-09-01",
      obs: "",
      evidencias: [],
    });
    expect(r.ultima_execucao).toBe("2026-11-10");
    expect(r.execucoes![0]!.data).toBe("2026-09-01");
  });
  it("mantém o histórico do mais novo para o mais antigo", () => {
    let r = rotina();
    for (const data of ["2026-11-01", "2026-11-20", "2026-11-10"])
      r = registrarExecucao(r, { data, obs: "", evidencias: [] });
    expect(r.execucoes!.map((e) => e.data)).toEqual(["2026-11-20", "2026-11-10", "2026-11-01"]);
  });
  it("guarda no máximo 50 execuções, descartando as mais antigas", () => {
    let r = rotina();
    for (let i = 0; i < MAX_EXECUCOES + 5; i++)
      r = registrarExecucao(r, {
        data: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`.replace(
          "2026-01",
          i < 28 ? "2026-01" : "2026-02",
        ),
        obs: "",
        evidencias: [],
      });
    expect(r.execucoes).toHaveLength(MAX_EXECUCOES);
  });
  it("não mexe na rotina original", () => {
    const antes = rotina({ ultima_execucao: "2026-10-01" });
    registrarExecucao(antes, { data: "2026-11-10", obs: "", evidencias: [] });
    expect(antes.ultima_execucao).toBe("2026-10-01");
    expect(antes.execucoes).toBeUndefined();
  });
});
