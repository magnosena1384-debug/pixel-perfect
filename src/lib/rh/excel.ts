import { read, utils } from "xlsx";

/** Linhas da primeira aba de um Excel (.xls ou .xlsx), com as células como texto formatado. */
export function linhasDoArquivo(conteudo: ArrayBuffer | Uint8Array): unknown[][] {
  const wb = read(conteudo, { type: "array" });
  const aba = wb.Sheets[wb.SheetNames[0]!];
  if (!aba) return [];
  return utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: null,
  });
}
