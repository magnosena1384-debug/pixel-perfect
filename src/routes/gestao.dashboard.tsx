import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Campo, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import {
  agruparCelulas,
  celulasDeLancamentos,
  hoje,
  porProduto,
  resumo,
  usePainelWebPosto,
  useVendasDasUnidades,
  vendasPorHora,
  type Grupo,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/dashboard")({
  component: Dashboard,
});

const TODOS = "Todos";
const TODAS = "Todas";
const WEBPOSTO = "webPosto";
const MANUAL = "Lançamentos manuais";

const tipos = {
  combustivel: { label: "Combustível", color: "var(--chart-2)" },
  produtos: { label: "Produtos", color: "var(--chart-1)" },
} satisfies ChartConfig;

const porTipoConfig = {
  total: { label: "Faturamento", color: "var(--chart-2)" },
} satisfies ChartConfig;

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const formatLitros = (l: number) => `${l.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;

// Tooltip com valores em R$ em vez de centavos.
function TooltipBRL({ config }: { config: ChartConfig }) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={(value, name, item) => (
            <div className="flex w-full items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: item.color ?? item.payload?.fill }}
              />
              <span className="text-muted-foreground">{config[name as string]?.label ?? name}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {formatBRL(Number(value))}
              </span>
            </div>
          )}
        />
      }
    />
  );
}

function Dashboard() {
  const [de, setDe] = useState(`${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje());
  const [fonte, setFonte] = useState<string | null>(null);
  const [unidade, setUnidade] = useState(TODAS);
  const [colaborador, setColaborador] = useState(TODOS);

  const manuais = useVendasDasUnidades();
  const webposto = usePainelWebPosto(de, ate);
  // Sem escolha do usuário, mostra o webPosto quando há cupons importados no período.
  const escolhida = fonte ?? (webposto.data?.length ? WEBPOSTO : MANUAL);
  const isLoading = escolhida === WEBPOSTO ? webposto.isLoading : manuais.isLoading;
  const erro = escolhida === WEBPOSTO ? webposto.error : manuais.error;

  const noPeriodo =
    escolhida === WEBPOSTO
      ? (webposto.data ?? [])
      : celulasDeLancamentos((manuais.data ?? []).filter((v) => v.data >= de && v.data <= ate));
  const unidades = [...new Set(noPeriodo.map((c) => c.unidade))].sort();
  const colaboradores = [...new Set(noPeriodo.map((c) => c.colaborador))].sort();
  const filtradas = noPeriodo.filter(
    (c) =>
      (unidade === TODAS || c.unidade === unidade) &&
      (colaborador === TODOS || c.colaborador === colaborador),
  );

  const geral = resumo(filtradas);
  const combustivel = resumo(filtradas, "combustivel");
  const produtos = resumo(filtradas, "produtos");

  const horas = vendasPorHora(filtradas);
  const semHora = resumo(filtradas.filter((c) => c.hora == null)).vendas;
  // Mostra só a faixa de horas com movimento, para o gráfico não ficar vazio nas pontas.
  const comVenda = horas.filter((h) => h.combustivel + h.produtos > 0).map((h) => h.hora);
  const faixaHoras = comVenda.length
    ? horas.slice(Math.min(...comVenda), Math.max(...comVenda) + 1)
    : [];

  const porUnidade = agruparCelulas(filtradas, "unidade");
  const porColaborador = agruparCelulas(filtradas, "colaborador");
  const porCombustivel = porProduto(filtradas, "combustivel");

  const cards = [
    {
      label: "Faturamento",
      valor: formatBRL(geral.total),
      sub: `${geral.vendas} vendas`,
      cls: "bg-ink text-cream",
    },
    {
      label: "Ticket médio combustível",
      valor: formatBRL(combustivel.ticket),
      sub: `${combustivel.vendas} abastecimentos · ${formatLitros(combustivel.litros)}`,
      cls: "bg-secondary text-secondary-foreground",
    },
    {
      label: "Ticket médio produtos",
      valor: formatBRL(produtos.ticket),
      sub: `${produtos.vendas} vendas · ${formatBRL(produtos.total)}`,
      cls: "bg-primary text-primary-foreground",
    },
    {
      label: "Preço médio por litro",
      valor: combustivel.litros
        ? formatBRL(Math.round(combustivel.total / combustivel.litros))
        : "—",
      sub: `combustível · ${formatBRL(combustivel.total)}`,
      cls: "bg-card",
    },
  ];

  return (
    <div className="space-y-8">
      <Painel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Fonte">
            <Seletor
              opcoes={[WEBPOSTO, MANUAL]}
              value={escolhida}
              onChange={(e) => {
                setFonte(e.target.value);
                setColaborador(TODOS);
              }}
            />
          </Campo>
          <Campo label="De">
            <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo label="Até">
            <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Campo>
          <Campo label="Unidade">
            <Seletor
              opcoes={[TODAS, ...unidades]}
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            />
          </Campo>
          <Campo label="Colaborador">
            <Seletor
              opcoes={[TODOS, ...colaboradores]}
              value={colaborador}
              onChange={(e) => setColaborador(e.target.value)}
            />
          </Campo>
        </div>
      </Painel>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : erro ? (
        <Painel>
          <Vazio>Não foi possível carregar as vendas: {erro.message}</Vazio>
        </Painel>
      ) : filtradas.length === 0 ? (
        <Painel>
          <Vazio>
            {escolhida === WEBPOSTO
              ? "Nenhum cupom do webPosto no período e filtros selecionados. O administrador importa as vendas em Admin → webPosto."
              : "Nenhuma venda no período e filtros selecionados. Registre vendas na aba Vendas."}
          </Vazio>
        </Painel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className={`rounded-3xl p-6 ${c.cls}`}>
                <p className="eyebrow opacity-70">{c.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{c.valor}</p>
                <p className="mt-1 text-sm opacity-70">{c.sub}</p>
              </div>
            ))}
          </div>

          <Painel titulo="Vendas por hora">
            {faixaHoras.length === 0 ? (
              <Vazio>As vendas do período não têm hora registrada.</Vazio>
            ) : (
              <ChartContainer config={tipos} className="aspect-auto h-72 w-full">
                <BarChart data={faixaHoras} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="hora"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(h: number) => `${h}h`}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(v: number) => reais(v)}
                  />
                  <TooltipBRL config={tipos} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="combustivel" stackId="a" fill="var(--color-combustivel)" />
                  <Bar
                    dataKey="produtos"
                    stackId="a"
                    fill="var(--color-produtos)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
            {semHora > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {semHora} venda(s) sem hora registrada não aparecem neste gráfico.
              </p>
            )}
          </Painel>

          <div className="grid gap-8 lg:grid-cols-2">
            <TicketPor titulo="Ticket médio por unidade" coluna="Unidade" grupos={porUnidade} />
            <TicketPor
              titulo="Ticket médio por colaborador"
              coluna="Colaborador"
              grupos={porColaborador}
            />
          </div>

          <Painel titulo="Por tipo de combustível">
            {porCombustivel.length === 0 ? (
              <Vazio>Sem vendas de combustível no período.</Vazio>
            ) : (
              <div className="grid gap-8 lg:grid-cols-2">
                <ChartContainer config={porTipoConfig} className="aspect-auto h-64 w-full">
                  <BarChart
                    data={porCombustivel.map((g) => ({ nome: g.nome, total: g.resumo.total }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <YAxis
                      dataKey="nome"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={160}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => reais(v)}
                    />
                    <TooltipBRL config={porTipoConfig} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
                <Tabela
                  colunas={["Combustível", "Litros", "Faturamento", "R$/L", "Ticket médio"]}
                  linhas={porCombustivel.map((g) => [
                    g.nome,
                    formatLitros(g.resumo.litros),
                    formatBRL(g.resumo.total),
                    g.resumo.litros ? formatBRL(Math.round(g.resumo.total / g.resumo.litros)) : "—",
                    formatBRL(g.resumo.ticket),
                  ])}
                />
              </div>
            )}
          </Painel>
        </>
      )}
    </div>
  );
}

function TicketPor({
  titulo,
  coluna,
  grupos,
}: {
  titulo: string;
  coluna: string;
  grupos: Grupo[];
}) {
  const dados = grupos.map((g) => ({
    nome: g.nome,
    combustivel: g.combustivel.ticket,
    produtos: g.produtos.ticket,
  }));
  return (
    <Painel titulo={titulo}>
      <ChartContainer config={tipos} className="aspect-auto h-64 w-full">
        <BarChart data={dados} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="nome" tickLine={false} axisLine={false} interval={0} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(v: number) => reais(v)}
          />
          <TooltipBRL config={tipos} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="combustivel" fill="var(--color-combustivel)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="produtos" fill="var(--color-produtos)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <div className="mt-6">
        <Tabela
          colunas={[coluna, "Faturamento", "Ticket comb.", "Ticket prod.", "Ticket geral"]}
          linhas={grupos.map((g) => [
            g.nome,
            formatBRL(g.geral.total),
            g.combustivel.vendas ? formatBRL(g.combustivel.ticket) : "—",
            g.produtos.vendas ? formatBRL(g.produtos.ticket) : "—",
            formatBRL(g.geral.ticket),
          ])}
        />
      </div>
    </Painel>
  );
}

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {colunas.map((c, i) => (
              <th key={c} className={`py-2 font-medium ${i ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {linhas.map((l) => (
            <tr key={l[0]}>
              {l.map((v, i) => (
                <td
                  key={i}
                  className={`whitespace-nowrap py-2 ${i ? "text-right tabular-nums" : "font-semibold"}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
