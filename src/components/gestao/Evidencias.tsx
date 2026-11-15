import { useQuery } from "@tanstack/react-query";
import { Camera, Image as ImagemIcone, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enderecosDasEvidencias } from "@/lib/evidencias";
import { MAX_FOTOS, vagasDeFotos, validarImagem } from "@/lib/evidencias-regras";
import type { Evidencia } from "@/lib/gestao";

/**
 * Campo de evidências em fotos: "Tirar foto" abre a câmera do celular e "Escolher da galeria" abre
 * a galeria (várias de uma vez). As fotos ficam no aparelho até quem preenche gravar o registro.
 */
export function CampoEvidencias({
  fotos,
  onChange,
  desabilitado = false,
}: {
  fotos: File[];
  onChange: (fotos: File[]) => void;
  desabilitado?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const vagas = vagasDeFotos(fotos.length);

  const previas = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas]);

  function receber(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidas = [...(e.target.files ?? [])];
    e.target.value = ""; // permite escolher a mesma foto de novo
    const boas: File[] = [];
    for (const f of escolhidas) {
      const erro = validarImagem(f);
      if (erro) toast.error(`${f.name || "Foto"}: ${erro}`);
      else boas.push(f);
    }
    if (boas.length > vagas) toast.error(`Cabem no máximo ${MAX_FOTOS} fotos por registro.`);
    if (boas.length) onChange([...fotos, ...boas.slice(0, vagas)]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full"
          disabled={desabilitado || vagas === 0}
          onClick={() => camera.current?.click()}
        >
          <Camera className="mr-2 size-4" aria-hidden /> Tirar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full"
          disabled={desabilitado || vagas === 0}
          onClick={() => galeria.current?.click()}
        >
          <ImagemIcone className="mr-2 size-4" aria-hidden /> Escolher da galeria
        </Button>
        <span className="text-sm text-muted-foreground">
          {fotos.length} de {MAX_FOTOS} fotos
        </span>
      </div>
      {/* Câmera traseira direto no celular; no computador abre o seletor de arquivos. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={receber}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={receber}
      />
      {fotos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="relative">
              <img
                src={previas[i]}
                alt={`Foto ${i + 1}: ${f.name}`}
                className="size-20 rounded-xl object-cover"
              />
              <button
                type="button"
                aria-label={`Tirar a foto ${i + 1}`}
                disabled={desabilitado}
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-ink text-cream shadow"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Miniaturas das fotos já gravadas; clicar abre a foto inteira numa aba nova. */
export function GaleriaEvidencias({ evidencias }: { evidencias: Evidencia[] | undefined }) {
  const caminhos = useMemo(() => (evidencias ?? []).map((e) => e.caminho), [evidencias]);
  const { data: enderecos, error } = useQuery({
    queryKey: ["evidencias", "enderecos", caminhos],
    enabled: caminhos.length > 0,
    staleTime: 50 * 60 * 1000, // os endereços valem 1 hora
    queryFn: () => enderecosDasEvidencias(caminhos),
  });
  if (!evidencias || evidencias.length === 0) return null;
  if (error) return <p className="text-sm text-destructive">Não foi possível abrir as fotos.</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {evidencias.map((e, i) => {
        const url = enderecos?.[e.caminho];
        return (
          <li key={e.caminho}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Evidência ${i + 1}: ${e.nome}`}
                  loading="lazy"
                  className="size-20 rounded-xl object-cover"
                />
              </a>
            ) : (
              <span className="flex size-20 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
                …
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
