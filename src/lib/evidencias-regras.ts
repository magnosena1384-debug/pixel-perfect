import type { Evidencia, Execucao, Rotina } from "@/lib/gestao";

// Regras puras das fotos de evidência (sem navegador nem banco): o que aceita, onde guarda e como
// a rotina registra uma execução.

export type ModuloEvidencia = "rotinas" | "manutencao";

export const BUCKET_EVIDENCIAS = "gestao-evidencias";
/** Fotos por registro (por execução de rotina ou por inspeção). */
export const MAX_FOTOS = 10;
/** Foto original acima disto é recusada antes de reduzir (fotos de celular costumam ter 3 a 8 MB). */
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
/** Maior lado da foto depois de reduzida, em pixels. */
export const LADO_MAXIMO = 1600;
/** Histórico de execuções guardado por rotina. */
export const MAX_EXECUCOES = 50;

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Mensagem de erro se o arquivo não serve como foto; null se serve. */
export function validarImagem(f: { type: string; size: number }): string | null {
  if (!TIPOS_ACEITOS.includes(f.type)) return "Use uma foto (JPG, PNG ou WebP).";
  if (f.size === 0) return "A foto está vazia.";
  if (f.size > MAX_ORIGINAL_BYTES) return "A foto passa de 30 MB.";
  return null;
}

/** Quantas fotos ainda cabem. */
export function vagasDeFotos(jaTem: number, limite = MAX_FOTOS): number {
  return Math.max(0, limite - jaTem);
}

/** "<unidade>/<modulo>/<hora>-<sufixo>.jpg": a unidade e o módulo é que dão acesso à foto. */
export function caminhoDaEvidencia(
  unidadeId: string,
  modulo: ModuloEvidencia,
  agora: number,
  sufixo: string,
): string {
  return `${unidadeId}/${modulo}/${agora.toString(36)}-${sufixo}.jpg`;
}

/** Tamanho depois de reduzir: o maior lado vira `maximo`, sem ampliar e sem deformar. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  maximo = LADO_MAXIMO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return { largura, altura };
  const fator = maximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

/** Caminhos de todas as fotos de uma lista de registros (para apagar junto com o registro). */
export function caminhosDeEvidencias(...listas: (Evidencia[] | undefined)[]): string[] {
  return listas.flatMap((l) => l ?? []).map((e) => e.caminho);
}

/**
 * Registra uma execução na rotina: entra no início do histórico (limitado), e a última execução
 * passa a ser a mais recente entre a anterior e a nova (registrar uma execução antiga não "volta"
 * a data).
 */
export function registrarExecucao(rotina: Rotina, execucao: Execucao): Rotina {
  const execucoes = [execucao, ...(rotina.execucoes ?? [])]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, MAX_EXECUCOES);
  const ultima =
    rotina.ultima_execucao && rotina.ultima_execucao > execucao.data
      ? rotina.ultima_execucao
      : execucao.data;
  return { ...rotina, ultima_execucao: ultima, execucoes };
}
