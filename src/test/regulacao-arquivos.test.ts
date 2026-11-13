import { describe, expect, it } from "vitest";
import { caminhoDoArquivo, LIMITE_BYTES, validarArquivo } from "@/lib/regulacao-arquivos";

describe("validarArquivo", () => {
  it("aceita PDF, JPG e PNG dentro do limite", () => {
    expect(validarArquivo({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validarArquivo({ type: "image/jpeg", size: LIMITE_BYTES })).toBeNull();
    expect(validarArquivo({ type: "image/png", size: 1 })).toBeNull();
  });
  it("recusa outro tipo, arquivo vazio e arquivo grande demais", () => {
    expect(validarArquivo({ type: "application/zip", size: 10 })).toMatch(/PDF, JPG ou PNG/);
    expect(validarArquivo({ type: "application/pdf", size: 0 })).toMatch(/vazio/);
    expect(validarArquivo({ type: "application/pdf", size: LIMITE_BYTES + 1 })).toMatch(/50 MB/);
  });
});

describe("caminhoDoArquivo", () => {
  it("começa pela pasta da unidade e leva o id do documento", () => {
    const c = caminhoDoArquivo("u-123", "doc-9", "application/pdf", 1000);
    expect(c.startsWith("u-123/doc-9-")).toBe(true);
    expect(c.endsWith(".pdf")).toBe(true);
  });
  it("troca a extensão conforme o tipo e muda a cada envio", () => {
    expect(caminhoDoArquivo("u", "d", "image/jpeg", 5)).toMatch(/\.jpg$/);
    expect(caminhoDoArquivo("u", "d", "application/pdf", 1)).not.toBe(
      caminhoDoArquivo("u", "d", "application/pdf", 2),
    );
  });
});
