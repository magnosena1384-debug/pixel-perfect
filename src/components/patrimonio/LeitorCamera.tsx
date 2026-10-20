import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";

/**
 * Lê QR codes pela câmera traseira do celular (Android e iPhone). Chama `aoLer` com o texto de
 * cada código, ignorando o mesmo código lido de novo nos 2 segundos seguintes.
 */
export function LeitorCamera({
  aoLer,
  aoFalhar,
}: {
  aoLer: (texto: string) => void;
  aoFalhar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const ultimo = useRef({ texto: "", quando: 0 });
  const aoLerAtual = useRef(aoLer);
  aoLerAtual.current = aoLer;
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    let leitor: QrScanner | null = null;
    let ativo = true;
    void (async () => {
      try {
        // A biblioteca é carregada só quando alguém abre a câmera.
        const { default: Scanner } = await import("qr-scanner");
        if (!ativo || !video.current) return;
        leitor = new Scanner(
          video.current,
          (r) => {
            const agora = Date.now();
            if (r.data === ultimo.current.texto && agora - ultimo.current.quando < 2000) return;
            ultimo.current = { texto: r.data, quando: agora };
            aoLerAtual.current(r.data);
          },
          { preferredCamera: "environment", highlightScanRegion: false, maxScansPerSecond: 8 },
        );
        await leitor.start();
        if (ativo) setPronta(true);
      } catch {
        if (ativo) aoFalhar();
      }
    })();
    return () => {
      ativo = false;
      leitor?.destroy();
    };
    // aoFalhar só é usado na abertura; reabrir a câmera a cada render seria pior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink">
      <video
        ref={video}
        className="aspect-square w-full object-cover sm:aspect-video"
        muted
        playsInline
      />
      {/* Moldura indicando onde mirar. */}
      <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-primary" />
      {!pronta && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-cream">
          Abrindo a câmera…
        </p>
      )}
    </div>
  );
}
