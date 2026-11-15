import { supabase } from "@/integrations/supabase/client";
import type { Evidencia } from "@/lib/gestao";
import {
  BUCKET_EVIDENCIAS,
  caminhoDaEvidencia,
  dimensoesReduzidas,
  validarImagem,
  type ModuloEvidencia,
} from "@/lib/evidencias-regras";

// Fotos de evidência: reduz no aparelho (a foto de celular tem vários MB), envia para o espaço
// privado "gestao-evidencias" e abre por endereços temporários.

/** Reduz a foto para no máximo 1600 px e a converte em JPEG (respeita a orientação do celular). */
export async function reduzirImagem(arquivo: File): Promise<Blob> {
  const erro = validarImagem(arquivo);
  if (erro) throw new Error(erro);
  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não foi possível ler esta foto. Tente outra, em JPG ou PNG.");
  }
  const { largura, altura } = dimensoesReduzidas(imagem.width, imagem.height);
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("O navegador não conseguiu preparar a foto.");
  contexto.fillStyle = "#ffffff"; // PNG com fundo transparente vira fundo branco no JPEG
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) throw new Error("Não foi possível preparar a foto.");
  return blob;
}

const sufixo = () => Math.random().toString(36).slice(2, 8);

/** Envia as fotos; se uma falhar, apaga as que já tinham subido e avisa. */
export async function enviarEvidencias(
  arquivos: File[],
  unidadeId: string,
  modulo: ModuloEvidencia,
): Promise<Evidencia[]> {
  const enviadas: Evidencia[] = [];
  try {
    for (const arquivo of arquivos) {
      const foto = await reduzirImagem(arquivo);
      const caminho = caminhoDaEvidencia(unidadeId, modulo, Date.now(), sufixo());
      const { error } = await supabase.storage
        .from(BUCKET_EVIDENCIAS)
        .upload(caminho, foto, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      enviadas.push({ caminho, nome: arquivo.name || "foto.jpg", em: new Date().toISOString() });
    }
    return enviadas;
  } catch (e) {
    if (enviadas.length) await apagarEvidencias(enviadas.map((x) => x.caminho));
    throw e;
  }
}

/** Endereços temporários (1 hora) para mostrar as fotos, por caminho. */
export async function enderecosDasEvidencias(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .createSignedUrls(caminhos, 3600);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  );
}

/** Apaga as fotos (sem reclamar se alguma já não existir). */
export async function apagarEvidencias(caminhos: string[]) {
  if (caminhos.length === 0) return;
  await supabase.storage.from(BUCKET_EVIDENCIAS).remove(caminhos);
}
