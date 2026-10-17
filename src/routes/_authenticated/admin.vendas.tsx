import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Painel, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import { addDias, hoje } from "@/lib/gestao";
import {
  agrupar,
  gerarExemplo,
  paraLancamentos,
  porCombustivel,
  porHora,
  totais,
  type Grupo,
  type RegistroImportado,
} from "@/lib/dashboard-vendas";

export const Route = createFileRoute("/_authenticated/admin/vendas")({
  component: DashboardVendas,
});

const POR_PAGINA = 1000;
const MAX_REGISTROS = 50000;

const grafico = {
  combustivel: { label: "Combustível", color: "var(--chart-2)" },
  produto: { label: "Produtos", color: "var(--chart-1)" },
} satisfies ChartConfig;

const litrosFmt = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`;

function DashboardVendas() {
  const [inicio, setInicio] = useState(addDias(hoje(), -6));
  const [fim, setFim] = useState(hoje());
  const [unidade, setUnidade] = useState("");

  const { data: unidades = [] } = useQuery({
    queryKey: ["dashboard-vendas", "unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, ordem, webposto_empresa")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const { data: registros, isLoading } = useQuery({
    queryKey: ["dashboard-vendas", "registros", inicio, fim],
    queryFn: async () => {
      const lista: RegistroImportado[] = [];
      for (let de = 0; de < MAX_REGISTROS; de += POR_PAGINA) {
        const { data, error } = await supabase
          .from("webposto_registros")
          .select("endpoint, codigo, unidade_id, data_ref, dados")
          .in("endpoint", ["ABASTECIMENTO", "VENDA_ITEM"])
          .gte("data_ref", inicio)
          .lte("data_ref", fim)
          .order("endpoint")
          .order("codigo")
          .range(de, de + POR_PAGINA - 1);
        if (error) throw error;
        lista.push(...data);
        if (data.length < POR_PAGINA) break;
      }
      return lista;
    },
  });

  const reais = paraLancamentos(registros ?? []);
  const exemplo = !isLoading && reais.length === 0;
  const postos = unidades.filter((u) => u.nome !== "Escritório Central");
  const todos = exemplo
    ? gerarExemplo(
        postos.map((u) => u.id),
        inicio,
        fim,
      )
    : reais;
  const lancs = unidade ? todos.filter((l) => l.unidadeId === unidade) : todos;

  const geral = totais(lancs);
  const comb = totais(lancs.filter((l) => l.categoria === "combustivel"));
  const prod = totais(lancs.filter((l) => l.categoria === "produto"));
  const horas = porHora(lancs);
  const semHora = lancs.filter((l) => l.hora == null).length;
  const combustiveis = porCombustivel(lancs);
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "Sem unidade";
  const porUnidade = agrupar(lancs, (l) => l.unidadeId ?? "");
  const porColaborador = agrupar(lancs, (l) => l.colaborador);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-card p-6">
        <div>
          <h2 className="text-2xl font-bold uppercase">Dashboard de vendas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Combustível e produtos por hora, unidade, colaborador e tipo de combustível.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dv-inicio">De</Label>
            <Input
              id="dv-inicio"
              type="date"
              value={inicio}
              max={fim}
              onChange={(e) => e.target.value && setInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dv-fim">Até</Label>
            <Input
              id="dv-fim"
              type="date"
              value={fim}
              min={inicio}
              onChange={(e) => e.target.value && setFim(e.target.value)}
            />
          </div>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="h-9 rounded-full border bg-background px-3 text-sm"
            aria-label="Filtrar por unidade"
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {exemplo && (
        <div className="rounded-3xl border-2 border-dashed border-amber-500 bg-amber-100 p-5 text-sm text-black">
          <p className="font-bold uppercase">Dados de exemplo</p>
          <p className="mt-1">
            Ainda não há vendas do webPosto importadas para este período, então os números abaixo
            são fictícios, só para mostrar o painel. Importe abastecimentos e itens vendidos em{" "}
            <Link to="/admin/webposto" className="font-semibold underline">
              webPosto
            </Link>{" "}
            e o painel passa a usar os dados reais.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Total vendido" valor={formatBRL(geral.totalCentavos)} destaque>
          {geral.cupons.toLocaleString("pt-BR")} vendas
        </Indicador>
        <Indicador titulo="Ticket médio" valor={formatBRL(geral.ticketCentavos)}>
          por venda
        </Indicador>
        <Indicador titulo="Combustível" valor={formatBRL(comb.totalCentavos)}>
          {litrosFmt(comb.litros)} · ticket {formatBRL(comb.ticketCentavos)}
        </Indicador>
        <Indicador titulo="Produtos" valor={formatBRL(prod.totalCentavos)}>
          {prod.cupons.toLocaleString("pt-BR")} vendas · ticket {formatBRL(prod.ticketCentavos)}
        </Indicador>
      </div>

      <Painel titulo="Vendas por hora">
        {lancs.length === 0 ? (
          <Vazio>{isLoading ? "Carregando…" : "Sem vendas no período."}</Vazio>
        ) : (
          <>
            <ChartContainer config={grafico} className="aspect-auto h-72 w-full">
              <BarChart data={horas}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hora" tickLine={false} axisLine={false} interval={1} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v: number) =>
                    v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v, nome) => (
                        <span className="flex w-full justify-between gap-4">
                          <span>{grafico[nome as keyof typeof grafico]?.label ?? nome}</span>
                          <span className="font-mono font-semibold">
                            {formatBRL(Math.round(Number(v) * 100))}
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="combustivel" stackId="a" fill="var(--color-combustivel)" />
                <Bar
                  dataKey="produto"
                  stackId="a"
                  fill="var(--color-produto)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
            {semHora > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {semHora} lançamento(s) sem hora ficaram fora do gráfico.
              </p>
            )}
          </>
        )}
      </Painel>

      <Painel titulo="Por tipo de combustível">
        {combustiveis.length === 0 ? (
          <Vazio>Sem vendas de combustível no período.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Litros</th>
                  <th className="py-2 pr-3 text-right">Preço médio/L</th>
                  <th className="py-2 pr-3 text-right">Abastecimentos</th>
                  <th className="py-2 text-right">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {combustiveis.map((c) => (
                  <tr key={c.item} className="border-t">
                    <td className="py-2 pr-3">
                      <p className="font-semibold">{c.item}</p>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-forest"
                          style={{ width: `${(c.totalCentavos / comb.totalCentavos) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      {formatBRL(c.totalCentavos)}
                    </td>
                    <td className="py-2 pr-3 text-right">{litrosFmt(c.litros)}</td>
                    <td className="py-2 pr-3 text-right">
                      {c.precoLitroCentavos != null ? formatBRL(c.precoLitroCentavos) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">{c.cupons.toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-right">{formatBRL(c.ticketCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <TabelaTicket
        titulo="Ticket médio por unidade"
        coluna="Unidade"
        grupos={porUnidade}
        nome={nomeUnidade}
      />
      <TabelaTicket
        titulo="Ticket médio por colaborador"
        coluna="Colaborador"
        grupos={porColaborador}
        nome={(k) => k}
      />
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  destaque,
  children,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-3xl p-6 ${destaque ? "bg-primary" : "bg-card"}`}>
      <p className="eyebrow opacity-70">{titulo}</p>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      <p className="mt-1 text-sm opacity-70">{children}</p>
    </div>
  );
}

function TabelaTicket({
  titulo,
  coluna,
  grupos,
  nome,
}: {
  titulo: string;
  coluna: string;
  grupos: Grupo[];
  nome: (chave: string) => string;
}) {
  return (
    <Painel titulo={titulo}>
      {grupos.length === 0 ? (
        <Vazio>Sem vendas no período.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-3" rowSpan={2}>
                  {coluna}
                </th>
                <th className="py-1 pr-3 text-center" colSpan={2}>
                  Geral
                </th>
                <th className="py-1 pr-3 text-center" colSpan={2}>
                  Combustível
                </th>
                <th className="py-1 text-center" colSpan={2}>
                  Produtos
                </th>
              </tr>
              <tr className="text-right text-xs text-muted-foreground">
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Ticket</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Ticket</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.chave} className="border-t text-right">
                  <td className="py-2 pr-3 text-left font-medium">{nome(g.chave)}</td>
                  <td className="py-2 pr-3">{formatBRL(g.geral.totalCentavos)}</td>
                  <td className="py-2 pr-3 font-semibold">{formatBRL(g.geral.ticketCentavos)}</td>
                  <td className="py-2 pr-3">{formatBRL(g.combustivel.totalCentavos)}</td>
                  <td className="py-2 pr-3 font-semibold">
                    {g.combustivel.cupons ? formatBRL(g.combustivel.ticketCentavos) : "—"}
                  </td>
                  <td className="py-2 pr-3">{formatBRL(g.produto.totalCentavos)}</td>
                  <td className="py-2 font-semibold">
                    {g.produto.cupons ? formatBRL(g.produto.ticketCentavos) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}
