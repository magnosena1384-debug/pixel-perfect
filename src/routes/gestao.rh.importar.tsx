import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { formatData } from "@/lib/gestao";
import { gravarFrequencia, useImportacoesRh, useUnidadesCom } from "@/lib/rh/dados";
import { ErroRelatorio, lerRelatorio, type Relatorio } from "@/lib/rh/planilha";

export const Route = createFileRoute("/gestao/rh/importar")({
  component: Importar,
});

const NOMES: Record<string, string> = {
  frequencia: "Frequência",
  irregularidades: "Irregularidades",
  banco_horas: "Banco de Horas",
};

function Importar() {
  const qc = useQueryClient();
  const { unidades, isLoading } = useUnidadesCom("rh-importar");
  const [nomeUnidade, setNomeUnidade] = useState("");
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [campoArquivo, setCampoArquivo] = useState(0); // trocar a chave limpa o campo

  const unidade = unidades.find((u) => u.nome === nomeUnidade) ?? unidades[0];
  const importacoes = useImportacoesRh(unidade?.id);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!unidade)
    return (
      <Painel>
        <p>Você não tem acesso ao RH – importar em nenhuma unidade.</p>
      </Painel>
    );

  function limpar() {
    setArquivo(null);
    setRelatorio(null);
    setErro(null);
    setCampoArquivo((n) => n + 1);
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setRelatorio(null);
    setErro(null);
    if (!f) return;
    setArquivo(f.name);
    try {
      // O leitor de Excel é pesado: só carrega quando alguém escolhe um arquivo.
      const { linhasDoArquivo } = await import("@/lib/rh/excel");
      setRelatorio(lerRelatorio(linhasDoArquivo(await f.arrayBuffer())));
    } catch (ex) {
      setErro(
        ex instanceof ErroRelatorio
          ? ex.message
          : "Não foi possível abrir este arquivo. Confira se é o Excel exportado do QuarkRH.",
      );
    }
  }

  async function gravar() {
    if (!relatorio || !arquivo || !unidade) return;
    setGravando(true);
    try {
      await gravarFrequencia(unidade.id, arquivo, relatorio);
      const colaboradores = new Set(relatorio.dias.map((d) => d.colaborador)).size;
      toast.success(
        `${NOMES[relatorio.tipo]} de ${formatData(relatorio.de)} a ${formatData(relatorio.ate)}: ${colaboradores} colaboradores, ${relatorio.dias.length} dias`,
      );
      limpar();
      void qc.invalidateQueries({ queryKey: ["rh"] });
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  }

  const colaboradores = relatorio ? new Set(relatorio.dias.map((d) => d.colaborador)).size : 0;

  return (
    <div className="space-y-8">
      <Painel titulo="Importar do QuarkRH">
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          No QuarkRH, filtre o posto e exporte em Excel o Relatório de Frequência Analítico.
          Importar de novo o mesmo período substitui os dados daquele período nesta unidade.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Unidade">
            <Seletor
              opcoes={unidades.map((u) => u.nome)}
              value={unidade.nome}
              onChange={(e) => {
                setNomeUnidade(e.target.value);
                limpar();
              }}
            />
          </Campo>
          <Campo label="Arquivo do QuarkRH (.xls ou .xlsx)">
            <Input
              key={campoArquivo}
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => void escolher(e)}
            />
          </Campo>
        </div>
      </Painel>

      {erro && (
        <Painel className="border-2 border-destructive">
          <p className="font-semibold">{erro}</p>
          <p className="mt-1 text-sm text-muted-foreground">Nada foi gravado.</p>
        </Painel>
      )}

      {relatorio && (
        <Painel titulo={`Prévia: ${NOMES[relatorio.tipo]}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Cartao
              rotulo="Período"
              valor={`${formatData(relatorio.de)} – ${formatData(relatorio.ate)}`}
              className="bg-muted text-base"
            />
            <Cartao rotulo="Colaboradores" valor={colaboradores} className="bg-muted" />
            <Cartao rotulo="Dias de ponto" valor={relatorio.dias.length} className="bg-muted" />
            <Cartao
              rotulo="Linhas não lidas"
              valor={relatorio.problemas.length}
              className={relatorio.problemas.length ? "bg-amber-400 text-black" : "bg-muted"}
            />
          </div>
          {relatorio.problemas.length > 0 && (
            <ul className="mt-4 divide-y text-sm">
              {relatorio.problemas.map((p) => (
                <li key={p.linha} className="py-2">
                  Linha {p.linha}: {p.motivo}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex gap-2">
            <Button className="rounded-full" disabled={gravando} onClick={() => void gravar()}>
              {gravando ? "Gravando…" : `Gravar em ${unidade.nome}`}
            </Button>
            <Button variant="ghost" disabled={gravando} onClick={limpar}>
              Cancelar
            </Button>
          </div>
        </Painel>
      )}

      <Painel titulo="Últimas importações">
        {importacoes.isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : !importacoes.data?.length ? (
          <Vazio>Nenhuma importação nesta unidade ainda.</Vazio>
        ) : (
          <ul className="divide-y text-sm">
            {importacoes.data.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  <span className="font-semibold">{NOMES[i.relatorio] ?? i.relatorio}</span> ·{" "}
                  {formatData(i.periodo_de)} a {formatData(i.periodo_ate)} · {i.quantidade}{" "}
                  registros
                </span>
                <span className="text-muted-foreground">
                  {i.arquivo} · {new Date(i.criado_em).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
