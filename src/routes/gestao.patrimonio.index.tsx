import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, PilulaSituacao, Seletor, Tabela, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import { hoje, useUnidadesCom } from "@/lib/gestao";
import { normalizarTexto } from "@/lib/utils";
import { transferirBem, useBens, useEmpresasDoGrupo } from "@/lib/patrimonio/dados";
import { CATEGORIAS, depreciacao, formatarTombamento } from "@/lib/patrimonio/regras";

export const Route = createFileRoute("/gestao/patrimonio/")({
  component: Bens,
});

const TODAS = "Todas";
const TODOS = "Todos";
const SITUACOES = [
  { valor: TODAS, rotulo: "Todas (sem baixados)" },
  { valor: "em_uso", rotulo: "Em uso" },
  { valor: "com_defeito", rotulo: "Com defeito" },
  { valor: "em_transito", rotulo: "Em trânsito" },
  { valor: "baixado", rotulo: "Baixados" },
];

function Bens() {
  const { unidades } = useUnidadesCom("patrimonio");
  const { unidades: gerencia } = useUnidadesCom("patrimonio-gerenciar");
  const bens = useBens();
  const [empresa, setEmpresa] = useState(TODAS);
  const [setor, setSetor] = useState(TODOS);
  const [categoria, setCategoria] = useState(TODAS);
  const [situacao, setSituacao] = useState(TODAS);
  const [busca, setBusca] = useState("");
  const qc = useQueryClient();
  const empresas = useEmpresasDoGrupo();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Nome pelo cadastro do grupo: um bem a caminho de uma empresa da pessoa é de outra empresa.
  const nomeDaEmpresa = (id: string) =>
    empresas.data?.find((e) => e.id === id)?.nome ?? unidades.find((u) => u.id === id)?.nome ?? "";
  const todos = bens.data ?? [];
  const setores = [...new Set(todos.map((b) => b.setor).filter(Boolean))].sort();
  const termo = normalizarTexto(busca);
  const lista = todos.filter(
    (b) =>
      (empresa === TODAS || nomeDaEmpresa(b.unidadeId) === empresa) &&
      (setor === TODOS || b.setor === setor) &&
      (categoria === TODAS || b.categoria === categoria) &&
      (situacao === TODAS ? b.situacao !== "baixado" : b.situacao === situacao) &&
      (!termo ||
        [formatarTombamento(b.tombamento), b.nome, b.marca, b.modelo, b.numeroSerie].some((c) =>
          normalizarTexto(c).includes(termo),
        )),
  );

  // Seleção só para quem gerencia a empresa do bem e enquanto ele está em uso ou com defeito.
  const selecionavel = (b: (typeof todos)[number]) =>
    gerencia.some((u) => u.id === b.unidadeId) &&
    (b.situacao === "em_uso" || b.situacao === "com_defeito");
  const escolhidos = todos.filter((b) => selecionados.has(b.id) && selecionavel(b));
  const origens = new Set(escolhidos.map((b) => b.unidadeId));
  const destinos = (empresas.data ?? []).filter((e) => !origens.has(e.id));
  const destinoEscolhido = destinos.find((e) => e.id === destino) ?? destinos[0];

  function alternar(id: string, marcado: boolean) {
    const novo = new Set(selecionados);
    if (marcado) novo.add(id);
    else novo.delete(id);
    setSelecionados(novo);
  }

  async function transferirSelecionados() {
    if (!destinoEscolhido) return;
    if (!confirm(`Enviar ${escolhidos.length} bem(ns) para ${destinoEscolhido.nome}?`)) return;
    setEnviando(true);
    let enviados = 0;
    try {
      for (const b of escolhidos) {
        await transferirBem(b.id, destinoEscolhido.id, "");
        enviados++;
      }
      toast.success(
        `${enviados} bem(ns) enviados para ${destinoEscolhido.nome}; aguardando recebimento`,
      );
      setSelecionados(new Set());
    } catch (e) {
      toast.error(
        `${enviados} enviado(s); parou num erro: ${e instanceof Error ? e.message : "falha ao enviar"}`,
      );
    } finally {
      setEnviando(false);
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
    }
  }

  return (
    <div className="space-y-8">
      <Painel
        acao={
          gerencia.length > 0 && (
            <Button asChild className="rounded-full">
              <Link to="/gestao/patrimonio/novo">Cadastrar bem</Link>
            </Button>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Buscar">
            <Input
              type="search"
              placeholder="Tombamento, nome, nº de série…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </Campo>
          <Campo label="Empresa">
            <Seletor
              opcoes={[TODAS, ...unidades.map((u) => u.nome)]}
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            />
          </Campo>
          <Campo label="Setor">
            <Seletor
              opcoes={[TODOS, ...setores]}
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
            />
          </Campo>
          <Campo label="Categoria">
            <Seletor
              opcoes={[TODAS, ...CATEGORIAS]}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </Campo>
          <Campo label="Situação">
            <Seletor
              opcoes={SITUACOES}
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
            />
          </Campo>
        </div>
      </Painel>

      {escolhidos.length > 0 && (
        <Painel className="border-2 border-primary">
          <div className="flex flex-wrap items-end gap-3">
            <p className="font-semibold">{escolhidos.length} bem(ns) selecionado(s)</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link
                to="/gestao/patrimonio/etiquetas"
                search={{ ids: escolhidos.map((b) => b.id).join(",") }}
              >
                Imprimir etiquetas
              </Link>
            </Button>
            {destinoEscolhido && (
              <>
                <Campo label="Transferir para" className="w-64">
                  <Seletor
                    opcoes={destinos.map((e) => ({ valor: e.id, rotulo: e.nome }))}
                    value={destinoEscolhido.id}
                    onChange={(e) => setDestino(e.target.value)}
                  />
                </Campo>
                <Button
                  className="rounded-full"
                  disabled={enviando}
                  onClick={() => void transferirSelecionados()}
                >
                  {enviando ? "Enviando…" : "Transferir"}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setSelecionados(new Set())}>
              Limpar seleção
            </Button>
          </div>
        </Painel>
      )}

      <Painel titulo="Bens">
        {bens.isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : bens.error ? (
          <Vazio>Não foi possível carregar os bens: {bens.error.message}</Vazio>
        ) : todos.length === 0 ? (
          <Vazio>
            Nenhum bem cadastrado nesta empresa.
            {gerencia.length > 0 && (
              <>
                {" "}
                <Link to="/gestao/patrimonio/novo" className="font-semibold underline">
                  Cadastrar bem
                </Link>
              </>
            )}
          </Vazio>
        ) : lista.length === 0 ? (
          <Vazio>Nenhum bem com esses filtros.</Vazio>
        ) : (
          <Tabela
            colunas={[
              ...(gerencia.length ? ["Selecionar"] : []),
              "Tombamento",
              "Nome",
              "Empresa · setor",
              "Situação",
              "Valor atual",
            ]}
            linhas={lista.map((b) => [
              ...(gerencia.length
                ? [
                    selecionavel(b) ? (
                      <Checkbox
                        key="sel"
                        aria-label={`Selecionar ${formatarTombamento(b.tombamento)}`}
                        checked={selecionados.has(b.id)}
                        onCheckedChange={(v) => alternar(b.id, !!v)}
                        className="h-5 w-5"
                      />
                    ) : (
                      ""
                    ),
                  ]
                : []),
              <span key="t" className="font-mono">
                {formatarTombamento(b.tombamento)}
              </span>,
              <Link
                key="n"
                to="/gestao/patrimonio/bem/$id"
                params={{ id: b.id }}
                className="font-normal underline-offset-2 hover:underline"
              >
                {b.nome}
              </Link>,
              [nomeDaEmpresa(b.unidadeId), b.setor].filter(Boolean).join(" · "),
              <PilulaSituacao key="s" situacao={b.situacao} />,
              formatBRL(depreciacao(b, hoje()).atual),
            ])}
          />
        )}
      </Painel>
    </div>
  );
}
