import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toString as qrSvg } from "qrcode";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { useUnidadesCom } from "@/lib/gestao";
import { registrarEtiquetasImpressas, useBens } from "@/lib/patrimonio/dados";
import {
  FORMATOS,
  paginasDeEtiquetas,
  type Formato,
  type Pagina,
} from "@/lib/patrimonio/etiquetas";
import { formatarTombamento } from "@/lib/patrimonio/regras";
import { cn, normalizarTexto } from "@/lib/utils";

export const Route = createFileRoute("/gestao/patrimonio/etiquetas")({
  validateSearch: z.object({ ids: z.string().optional() }),
  component: Etiquetas,
});

function Etiquetas() {
  const qc = useQueryClient();
  const { ids } = Route.useSearch();
  const { unidades, isLoading } = useUnidadesCom("patrimonio-gerenciar");
  const bens = useBens();
  const [escolhidos, setEscolhidos] = useState<Set<string>>(
    () => new Set(ids ? ids.split(",") : []),
  );
  const [formato, setFormato] = useState<Formato>("termica-50x30");
  const [busca, setBusca] = useState("");
  const [imprimindo, setImprimindo] = useState(false);
  // Depois de abrir a impressão, a pessoa confirma se saiu certo; só então registra.
  const [conferindo, setConferindo] = useState(false);

  if (isLoading || bens.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!unidades.length)
    return (
      <Painel>
        <p>Você não tem permissão para imprimir etiquetas em nenhuma empresa.</p>
      </Painel>
    );

  const nomeDaEmpresa = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "";
  const imprimiveis = (bens.data ?? []).filter(
    (b) => b.situacao !== "baixado" && unidades.some((u) => u.id === b.unidadeId),
  );
  const paraReimprimir = imprimiveis.filter((b) => b.reimprimirEtiqueta);
  const termo = normalizarTexto(busca);
  const visiveis = imprimiveis.filter(
    (b) =>
      !termo ||
      [formatarTombamento(b.tombamento), b.nome, b.setor].some((c) =>
        normalizarTexto(c).includes(termo),
      ),
  );
  const selecionados = imprimiveis.filter((b) => escolhidos.has(b.id));
  const paginas = paginasDeEtiquetas(
    selecionados.map((b) => ({
      tombamento: b.tombamento,
      nome: b.nome,
      empresa: nomeDaEmpresa(b.unidadeId),
    })),
    formato,
  );

  function alternar(id: string, marcado: boolean) {
    const novo = new Set(escolhidos);
    if (marcado) novo.add(id);
    else novo.delete(id);
    setEscolhidos(novo);
  }

  function imprimir() {
    // No celular, print() não espera a janela fechar: a confirmação fica num botão à parte.
    window.print();
    setConferindo(true);
  }

  async function registrar() {
    setImprimindo(true);
    try {
      await registrarEtiquetasImpressas(selecionados.map((b) => b.id));
      toast.success(`${selecionados.length} etiqueta(s) registradas no histórico`);
      setConferindo(false);
      setEscolhidos(new Set());
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar a impressão.");
    } finally {
      setImprimindo(false);
    }
  }

  const { pagina } = FORMATOS[formato];
  return (
    <div className="space-y-8">
      {/* Na impressão, só a área de etiquetas (fora do layout do site) existe, no tamanho exato
          do papel: nada escondido ocupa espaço e empurra as etiquetas para outra página. */}
      <style>{`@media print {
        @page { size: ${pagina.largura}mm ${pagina.altura}mm; margin: 0; }
        body > *:not(#area-impressao) { display: none !important; }
      }`}</style>
      {createPortal(
        <div id="area-impressao" className="hidden print:block">
          <PaginasEtiquetas paginas={paginas} />
        </div>,
        document.body,
      )}

      <div className="space-y-8 print:hidden">
        <Painel titulo="Etiquetas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Formato">
              <Seletor
                opcoes={Object.entries(FORMATOS).map(([valor, f]) => ({ valor, rotulo: f.nome }))}
                value={formato}
                onChange={(e) => setFormato(e.target.value as Formato)}
              />
            </Campo>
            <Campo label="Buscar bem">
              <Input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Tombamento, nome ou setor"
              />
            </Campo>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {paraReimprimir.length > 0 && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setEscolhidos(new Set(paraReimprimir.map((b) => b.id)))}
              >
                Etiquetas para reimprimir ({paraReimprimir.length})
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEscolhidos(new Set())}>
              Limpar seleção
            </Button>
            <Button
              className="rounded-full"
              disabled={!selecionados.length || imprimindo}
              onClick={imprimir}
            >
              Imprimir {selecionados.length} etiqueta(s)
            </Button>
          </div>
          {conferindo && (
            <div className="mt-4 rounded-2xl border-2 border-primary p-4 text-sm" role="status">
              <p className="font-semibold">As etiquetas saíram certas?</p>
              <p className="mt-1 text-muted-foreground">
                Ao confirmar, a impressão entra no histórico de cada bem e eles saem da lista de
                reimpressão.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  className="rounded-full"
                  disabled={imprimindo}
                  onClick={() => void registrar()}
                >
                  {imprimindo ? "Registrando…" : "Sim, registrar"}
                </Button>
                <Button variant="ghost" onClick={() => setConferindo(false)}>
                  Não, vou imprimir de novo
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Na janela de impressão, escolha a impressora certa, tamanho do papel{" "}
            {formato === "pimaco-6180" ? "Carta" : "50 × 30 mm"}, margens “Nenhuma” e escala 100%.
          </p>
        </Painel>

        <Painel titulo="Escolher bens">
          {!imprimiveis.length ? (
            <Vazio>Nenhum bem cadastrado nesta empresa.</Vazio>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {visiveis.map((b) => (
                <li key={b.id}>
                  <label className="flex items-center gap-3 py-2 text-sm">
                    <Checkbox
                      checked={escolhidos.has(b.id)}
                      onCheckedChange={(v) => alternar(b.id, !!v)}
                    />
                    <span className="font-mono">{formatarTombamento(b.tombamento)}</span>
                    <span className="flex-1">{b.nome}</span>
                    <span className="text-muted-foreground">
                      {nomeDaEmpresa(b.unidadeId)}
                      {b.reimprimirEtiqueta ? " · reimprimir" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {paginas.length > 0 && (
        <Painel titulo="Prévia" className="print:hidden">
          <div className="space-y-4 overflow-x-auto">
            <PaginasEtiquetas paginas={paginas} comSombra />
          </div>
        </Painel>
      )}
    </div>
  );
}

/** As páginas de etiquetas em milímetros, para a prévia e para a impressão. */
function PaginasEtiquetas({ paginas, comSombra }: { paginas: Pagina[]; comSombra?: boolean }) {
  return (
    <>
      {paginas.map((p, i) => (
        <div
          key={i}
          className={cn("relative bg-white text-black", comSombra && "shadow")}
          style={{
            width: `${p.largura}mm`,
            height: `${p.altura}mm`,
            breakAfter: "page",
          }}
        >
          {p.etiquetas.map((e) => (
            <div
              key={e.numero}
              className="absolute flex items-center gap-[1.5mm] overflow-hidden p-[1.5mm]"
              style={{
                left: `${e.x}mm`,
                top: `${e.y}mm`,
                width: `${e.largura}mm`,
                height: `${e.altura}mm`,
              }}
            >
              <Qr texto={e.qr} tamanho={`${e.altura - 3}mm`} />
              <div className="min-w-0 leading-tight">
                <p className="font-mono text-[11pt] font-bold">{e.numero}</p>
                <p className="line-clamp-2 text-[7pt]">{e.nome}</p>
                <p className="truncate text-[6pt]">{e.empresa}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Qr({ texto, tamanho }: { texto: string; tamanho: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let ativo = true;
    void qrSvg(texto, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then(
      (s) => ativo && setSvg(s),
    );
    return () => {
      ativo = false;
    };
  }, [texto]);
  return (
    <div
      className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: tamanho, height: tamanho }}
      aria-label={`QR code ${texto}`}
      // O SVG vem da biblioteca de QR a partir do número do tombamento, não de texto do usuário.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
