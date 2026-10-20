import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, PilulaSituacao, Seletor, Tabela, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import { hoje, useUnidadesCom } from "@/lib/gestao";
import { normalizarTexto } from "@/lib/utils";
import { useBens } from "@/lib/patrimonio/dados";
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

  const nomeDaEmpresa = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "";
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
            colunas={["Tombamento", "Nome", "Empresa · setor", "Situação", "Valor atual"]}
            linhas={lista.map((b) => [
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
