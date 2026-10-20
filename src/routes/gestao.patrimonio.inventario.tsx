import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { LeitorCamera } from "@/components/patrimonio/LeitorCamera";
import { formatData, useUnidadesCom } from "@/lib/gestao";
import {
  abrirInventario,
  bemSemEtiqueta,
  fecharInventario,
  lerEtiqueta,
  marcarDefeito,
  useBens,
  useInventarioAberto,
  type RelatorioInventario,
} from "@/lib/patrimonio/dados";
import {
  avisoDaLeitura,
  lerNumero,
  resumoInventario,
  type Aviso,
  type ResultadoLeitura,
} from "@/lib/patrimonio/inventario";
import { formatarTombamento } from "@/lib/patrimonio/regras";
import { cn, normalizarTexto } from "@/lib/utils";

export const Route = createFileRoute("/gestao/patrimonio/inventario")({
  component: Inventario,
});

const CORES: Record<Aviso["tom"], string> = {
  certo: "bg-primary text-primary-foreground",
  atencao: "bg-amber-400 text-black",
  erro: "bg-destructive text-destructive-foreground",
};

/** Bip curto e vibração no celular, quando o aparelho permite. */
function avisarNoAparelho(tom: Aviso["tom"]) {
  try {
    navigator.vibrate?.(tom === "certo" ? 60 : [60, 60, 60]);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = tom === "certo" ? 880 : 330;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // sem som nem vibração: segue só com o aviso na tela
  }
}

function Inventario() {
  const qc = useQueryClient();
  const { unidades, isLoading } = useUnidadesCom("patrimonio");
  const [empresaId, setEmpresaId] = useState("");
  const empresa = unidades.find((u) => u.id === empresaId) ?? unidades[0];
  const inventario = useInventarioAberto(empresa?.id);
  const bens = useBens();
  const [ocupado, setOcupado] = useState(false);
  const [camera, setCamera] = useState<"desligada" | "ligada" | "falhou">("desligada");
  const [numero, setNumero] = useState("");
  const [ultima, setUltima] = useState<ResultadoLeitura | null>(null);
  const [invalido, setInvalido] = useState<string | null>(null);
  const [semEtiqueta, setSemEtiqueta] = useState(false);
  const [buscaSem, setBuscaSem] = useState("");
  const [relatorio, setRelatorio] = useState<RelatorioInventario | null>(null);
  // Leituras em fila: com leitor USB ou digitação rápida, nenhuma é descartada.
  const fila = useRef<Promise<void>>(Promise.resolve());

  if (isLoading || inventario.isLoading || bens.isLoading)
    return <p className="text-muted-foreground">Carregando…</p>;
  if (!empresa) return null;
  const erro = inventario.error ?? bens.error;
  if (erro)
    return (
      <Painel>
        <Vazio>Não foi possível carregar o inventário: {erro.message}</Vazio>
      </Painel>
    );

  const inv = inventario.data;
  const bensDaEmpresa = (bens.data ?? []).filter((b) => b.unidadeId === empresa.id);
  const leituras = inv?.leituras ?? [];
  const resumo = resumoInventario(bensDaEmpresa, leituras);
  const naoLidos = bensDaEmpresa.filter((b) => resumo.naoEncontrados.includes(b.id));
  const atualizar = () => void qc.invalidateQueries({ queryKey: ["patrimonio"] });

  async function acao(fazer: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fazer();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setOcupado(false);
    }
  }

  function ler(texto: string) {
    fila.current = fila.current.then(() => lerAgora(texto));
  }

  async function lerAgora(texto: string) {
    if (!inv) return;
    const n = lerNumero(texto);
    setInvalido(n == null ? texto.trim() || " " : null);
    if (n == null) {
      setUltima(null);
      avisarNoAparelho("erro");
      return;
    }
    try {
      const r = await lerEtiqueta(inv.id, n);
      setUltima(r);
      avisarNoAparelho(avisoDaLeitura(r).tom);
      atualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler.");
    }
  }

  // ---------- Sem inventário aberto ----------
  if (!inv)
    return (
      <div className="space-y-8">
        <Painel>
          <div className="flex flex-wrap items-end gap-4">
            {unidades.length > 1 && (
              <Campo label="Empresa" className="w-72">
                <Seletor
                  opcoes={unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
                  value={empresa.id}
                  onChange={(e) => {
                    setEmpresaId(e.target.value);
                    setRelatorio(null);
                  }}
                />
              </Campo>
            )}
            <Button
              className="h-11 rounded-full"
              disabled={ocupado}
              onClick={() =>
                void acao(async () => {
                  await abrirInventario(empresa.id);
                  setRelatorio(null);
                  atualizar();
                })
              }
            >
              {ocupado ? "Abrindo…" : `Abrir inventário de ${empresa.nome}`}
            </Button>
          </div>
        </Painel>
        {relatorio && <Relatorio relatorio={relatorio} bens={bensDaEmpresa} />}
      </div>
    );

  // ---------- Inventário aberto ----------
  const aviso: Aviso | null = invalido
    ? { tom: "erro", titulo: invalido, texto: "Isto não é um número de tombamento." }
    : ultima && avisoDaLeitura(ultima);
  const leituraDoUltimo =
    ultima && ultima.status !== "nao_existe" && ultima.bem.id
      ? leituras.find((l) => l.bemId === (ultima.bem as { id?: string }).id && !l.foraDaEmpresa)
      : undefined;
  const termo = normalizarTexto(buscaSem);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 bg-muted px-4 py-3">
        <div>
          <p className="eyebrow text-muted-foreground">{empresa.nome}</p>
          <p className="text-lg">
            <span className="text-3xl font-bold tabular-nums">{resumo.encontrados}</span> de{" "}
            {resumo.esperados} encontrados
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-full"
          disabled={ocupado}
          onClick={() => {
            if (
              !confirm(
                `Fechar o inventário? ${resumo.esperados - resumo.encontrados} bem(ns) ficarão como não encontrados.`,
              )
            )
              return;
            void acao(async () => {
              setRelatorio(await fecharInventario(inv.id));
              setUltima(null);
              setCamera("desligada");
              atualizar();
            });
          }}
        >
          Fechar inventário
        </Button>
      </div>

      {camera === "ligada" ? (
        <LeitorCamera aoLer={ler} aoFalhar={() => setCamera("falhou")} />
      ) : (
        <Button className="h-12 w-full rounded-full" onClick={() => setCamera("ligada")}>
          Ler etiqueta com a câmera
        </Button>
      )}
      {camera === "falhou" && (
        <p className="rounded-2xl bg-amber-400 p-3 text-sm text-black">
          Não foi possível usar a câmera. Digite o número ou use o leitor.
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ler(numero);
          setNumero("");
        }}
      >
        <Campo label="Número do tombamento" className="flex-1">
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="h-11"
          />
        </Campo>
        <Button type="submit" className="mt-auto h-11 rounded-full">
          Ler
        </Button>
      </form>

      {!aviso ? (
        <Painel>
          <Vazio>Aponte a câmera para uma etiqueta ou digite o número.</Vazio>
        </Painel>
      ) : (
        <div className={cn("rounded-3xl p-6", CORES[aviso.tom])} role="status" aria-live="polite">
          <p className="font-mono text-2xl font-bold">{aviso.titulo}</p>
          <p className="mt-1">{aviso.texto}</p>
          {leituraDoUltimo && (
            <Button
              variant="outline"
              className="mt-4 h-11 rounded-full border-current bg-transparent"
              disabled={ocupado}
              onClick={() =>
                void acao(async () => {
                  await marcarDefeito(inv.id, leituraDoUltimo.bemId, !leituraDoUltimo.comDefeito);
                  atualizar();
                })
              }
            >
              {leituraDoUltimo.comDefeito ? "Desmarcar defeito" : "Com defeito"}
            </Button>
          )}
        </div>
      )}

      <Painel
        titulo="Bem sem etiqueta"
        acao={
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setSemEtiqueta(!semEtiqueta)}
          >
            {semEtiqueta ? "Esconder" : `Escolher entre os ${naoLidos.length} não lidos`}
          </Button>
        }
      >
        {semEtiqueta &&
          (naoLidos.length === 0 ? (
            <Vazio>Todos os bens da empresa já foram lidos.</Vazio>
          ) : (
            <>
              <Input
                type="search"
                placeholder="Filtrar por nome ou setor"
                value={buscaSem}
                onChange={(e) => setBuscaSem(e.target.value)}
                className="mb-3"
              />
              <ul className="max-h-80 divide-y overflow-y-auto">
                {naoLidos
                  .filter(
                    (b) =>
                      !termo ||
                      [b.nome, b.setor, b.marca, b.modelo, b.numeroSerie].some((c) =>
                        normalizarTexto(c).includes(termo),
                      ),
                  )
                  .map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">
                        <span className="font-semibold">{b.nome}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {b.setor || "sem setor"}
                          {b.numeroSerie ? ` · série ${b.numeroSerie}` : ""}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 shrink-0 rounded-full"
                        disabled={ocupado}
                        onClick={() =>
                          void acao(async () => {
                            await bemSemEtiqueta(inv.id, b.id);
                            toast.success(`${b.nome}: encontrado; etiqueta vai para reimpressão`);
                            atualizar();
                          })
                        }
                      >
                        É este
                      </Button>
                    </li>
                  ))}
              </ul>
            </>
          ))}
      </Painel>

      <Painel titulo={`Lidos neste inventário (${leituras.length})`}>
        {leituras.length === 0 ? (
          <Vazio>Nenhuma leitura ainda.</Vazio>
        ) : (
          <ul className="divide-y text-sm">
            {leituras.map((l) => {
              const b = bensDaEmpresa.find((x) => x.id === l.bemId);
              return (
                <li key={l.bemId} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {b ? (
                      <>
                        <span className="font-mono">{formatarTombamento(b.tombamento)}</span> ·{" "}
                        {b.nome}
                      </>
                    ) : (
                      l.aviso
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {l.foraDaEmpresa
                      ? "de outra empresa"
                      : [l.comDefeito && "com defeito", l.semEtiqueta && "sem etiqueta"]
                          .filter(Boolean)
                          .join(" · ") || "encontrado"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Aberto em {formatData(inv.aberto_em.slice(0, 10))} por {inv.aberto_por_nome || "—"}.
        </p>
      </Painel>
    </div>
  );
}

function Relatorio({
  relatorio,
  bens,
}: {
  relatorio: RelatorioInventario;
  bens: { id: string; tombamento: number; nome: string; setor: string }[];
}) {
  const naoEncontrados = bens.filter((b) => relatorio.nao_encontrados.includes(b.id));
  return (
    <Painel titulo="Inventário fechado">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao rotulo="Encontrados" valor={relatorio.encontrados} className="bg-primary" />
        <Cartao
          rotulo="Não encontrados"
          valor={naoEncontrados.length}
          className={
            naoEncontrados.length ? "bg-destructive text-destructive-foreground" : "bg-card"
          }
        />
        <Cartao
          rotulo="Com defeito"
          valor={relatorio.com_defeito}
          className={relatorio.com_defeito ? "bg-amber-400 text-black" : "bg-card"}
        />
        <Cartao rotulo="De outra empresa" valor={relatorio.fora_da_empresa} />
      </div>
      {naoEncontrados.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Não encontrados (não foram baixados)</h3>
          <ul className="mt-2 divide-y text-sm">
            {naoEncontrados.map((b) => (
              <li key={b.id} className="py-2">
                <Link
                  to="/gestao/patrimonio/bem/$id"
                  params={{ id: b.id }}
                  className="underline-offset-2 hover:underline"
                >
                  <span className="font-mono">{formatarTombamento(b.tombamento)}</span> · {b.nome}
                </Link>
                <span className="text-muted-foreground"> · {b.setor || "sem setor"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Painel>
  );
}
