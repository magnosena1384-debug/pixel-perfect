import { supabase } from "@/integrations/supabase/client";

// Arquivos dos documentos da Regulação: PDF ou imagem, até 50 MB, no espaço privado
// "regulacao-documentos" (migração 0022), numa pasta por unidade.
export const BUCKET = "regulacao-documentos";
export const LIMITE_BYTES = 50 * 1024 * 1024;
export const ACEITA = "application/pdf,image/jpeg,image/png";

const EXTENSOES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Mensagem de erro se o arquivo não serve; null se serve. */
export function validarArquivo(f: { type: string; size: number }): string | null {
  if (!EXTENSOES[f.type]) return "Use um arquivo PDF, JPG ou PNG.";
  if (f.size === 0) return "O arquivo está vazio.";
  if (f.size > LIMITE_BYTES) return "O arquivo passa de 50 MB.";
  return null;
}

/** Caminho no espaço de arquivos: "<unidade>/<documento>-<hora>.<extensão>". */
export function caminhoDoArquivo(
  unidadeId: string,
  documentoId: string,
  tipo: string,
  agora = Date.now(),
): string {
  return `${unidadeId}/${documentoId}-${agora.toString(36)}.${EXTENSOES[tipo] ?? "bin"}`;
}

export async function anexarArquivo(file: File, unidadeId: string, documentoId: string) {
  const erro = validarArquivo(file);
  if (erro) throw new Error(erro);
  const caminho = caminhoDoArquivo(unidadeId, documentoId, file.type);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return caminho;
}

/** Endereço temporário (5 minutos) para abrir o arquivo. */
export async function enderecoDoArquivo(caminho: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 300);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível abrir o arquivo.");
  return data.signedUrl;
}

export async function apagarArquivo(caminho: string) {
  await supabase.storage.from(BUCKET).remove([caminho]);
}
