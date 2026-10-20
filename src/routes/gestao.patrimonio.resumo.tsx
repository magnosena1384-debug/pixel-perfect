import { createFileRoute } from "@tanstack/react-router";
import { Cartao, Painel, Tabela, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import { hoje, useUnidadesCom } from "@/lib/gestao";
import { useBens, useEmpresasDoGrupo } from "@/lib/patrimonio/dados";
import { resumoPatrimonio } from "@/lib/patrimonio/regras";

export const Route = createFileRoute("/gestao/patrimonio/resumo")({
  component: Resumo,
});

function Resumo() {
  const bens = useBens();
  const { unidades } = useUnidadesCom("patrimonio");
  const empresas = useEmpresasDoGrupo();

  if (bens.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (bens.error)
    return (
      <Painel>
        <Vazio>Não foi possível carregar os bens: {bens.error.message}</Vazio>
      </Painel>
    );

  // Só os bens das empresas da pessoa: o bem a caminho de uma empresa dela ainda é da origem.
  const r = resumoPatrimonio(
    (bens.data ?? []).filter((b) => unidades.some((u) => u.id === b.unidadeId)),
    hoje(),
  );
  if (r.total.quantidade === 0)
    return (
      <Painel>
        <Vazio>Nenhum bem cadastrado nesta empresa.</Vazio>
      </Painel>
    );

  const nome = (id: string) => empresas.data?.find((e) => e.id === id)?.nome ?? "—";
  const colunas = ["Bens", "Valor de compra", "Depreciação acumulada", "Valor atual"];
  const valores = (s: (typeof r)["total"]) => [
    s.quantidade,
    formatBRL(s.compra),
    formatBRL(s.acumulada),
    formatBRL(s.atual),
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao
          rotulo="Valor atual"
          valor={formatBRL(r.total.atual)}
          className="bg-ink text-cream"
        />
        <Cartao rotulo="Valor de compra" valor={formatBRL(r.total.compra)} />
        <Cartao rotulo="Depreciação acumulada" valor={formatBRL(r.total.acumulada)} />
        <Cartao rotulo="Bens" valor={r.total.quantidade} detalhe="sem os baixados" />
      </div>
      <Painel titulo="Por empresa">
        <Tabela
          colunas={["Empresa", ...colunas]}
          linhas={r.porEmpresa.map((e) => [nome(e.chave), ...valores(e)])}
        />
      </Painel>
      <Painel titulo="Por categoria">
        <Tabela
          colunas={["Categoria", ...colunas]}
          linhas={r.porCategoria.map((c) => [c.chave, ...valores(c)])}
        />
      </Painel>
    </div>
  );
}
