import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { Repetido } from "@/lib/patrimonio/dados";
import { formatarTombamento } from "@/lib/patrimonio/regras";

/** Aviso de nº de série já usado em outro bem, no cadastro e na edição. Nada foi gravado. */
export function AvisoSerieRepetida({
  bem,
  gravando,
  rotuloConfirmar,
  aoConfirmar,
  aoCorrigir,
}: {
  bem: Repetido;
  gravando: boolean;
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  aoCorrigir: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-400 p-4 text-sm" role="alert">
      <p className="font-semibold">
        {bem.id && bem.tombamento != null ? (
          <>
            Este nº de série já está no bem{" "}
            <Link to="/gestao/patrimonio/bem/$id" params={{ id: bem.id }} className="underline">
              {formatarTombamento(bem.tombamento)} – {bem.nome}
            </Link>{" "}
            ({bem.empresa}).
          </>
        ) : (
          <>Este nº de série já está num bem de {bem.empresa}.</>
        )}{" "}
        Nada foi gravado.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={gravando}
          onClick={aoConfirmar}
        >
          {rotuloConfirmar}
        </Button>
        <Button type="button" variant="ghost" onClick={aoCorrigir}>
          Corrigir
        </Button>
      </div>
    </div>
  );
}
