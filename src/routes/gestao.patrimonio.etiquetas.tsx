import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toString as qrSvg } from "qrcode";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { useUnidadesCom } from "@/lib/gestao";
import { registrarEtiquetasImpressas, useBens } from "@/lib/patrimonio/dados";
import { FORMATOS, paginasDeEtiquetas, type Formato } from "@/lib/patrimonio/etiquetas";
import { formatarTombamento } from "@/lib/patrimonio/regras";
import { normalizarTexto } from "@/lib/utils";

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

  async function imprimir() {
    setImprimindo(true);
    try {
      window.print(); // abre a janela de impressão do navegador e espera ela fechar
      await registrarEtiquetasImpressas(selecionados.map((b) => b.id));
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
      {/* Na impressão, só as etiquetas aparecem, no tamanho exato do papel. */}
      <style>{`@media print {
        @page { size: ${pagina.largura}mm ${pagina.altura}mm; margin: 0; }
        body * { visibility: hidden; }
        #area-etiquetas, #area-etiquetas * { visibility: visible; }
        #area-etiquetas { position: absolute; left: 0; top: 0; }
      }`}</style>

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
              onClick={() => void imprimir()}
            >
              {imprimindo ? "Imprimindo…" : `Imprimir ${selecionados.length} etiqueta(s)`}
            </Button>
          </div>
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
        <Painel titulo="Prévia" className="print:p-0">
          <div id="area-etiquetas" className="space-y-4 print:space-y-0">
            {paginas.map((p, i) => (
              <div
                key={i}
                className="relative bg-white text-black shadow print:shadow-none"
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
          </div>
        </Painel>
      )}
    </div>
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
