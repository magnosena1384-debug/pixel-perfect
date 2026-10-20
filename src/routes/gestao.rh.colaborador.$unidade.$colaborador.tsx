import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Campo, Cartao, Painel, Tabela, Vazio } from "@/components/gestao/ui";
import { addDias, formatData, hoje, useUnidadesCom } from "@/lib/gestao";
import { useDadosRh } from "@/lib/rh/dados";
import { diasQueContam, mesAMes, formatarPct, resumoRh, setores } from "@/lib/rh/indicadores";
import { minParaHoras } from "@/lib/rh/planilha";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestao/rh/colaborador/$unidade/$colaborador")({
  component: Ficha,
});

const grafico = {
  horas: { label: "Horas", color: "var(--chart-2)" },
  faltas: { label: "Faltas", color: "var(--destructive)" },
  atrasos: { label: "Atrasos", color: "var(--color-amber-400, oklch(0.83 0.16 84))" },
} satisfies ChartConfig;

const pilula: Record<string, string> = {
  Falta: "bg-destructive text-destructive-foreground",
  Atraso: "bg-amber-400 text-black",
};

const nomeDoMes = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

function Ficha() {
  const { unidade: unidadeId, colaborador } = Route.useParams();
  const { unidades, isLoading } = useUnidadesCom("rh");
  // A ficha começa nos últimos 12 meses para mostrar a evolução.
  const [de, setDe] = useState(`${addDias(hoje(), -365).slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje());
  const unidade = unidades.find((u) => u.id === unidadeId);
  const dados = useDadosRh(de, ate, unidade ? [unidade.id] : []);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!unidade)
    return (
      <Painel>
        <p>Você não tem acesso ao RH nesta unidade.</p>
      </Painel>
    );

  const dias = (dados.data?.dias ?? []).filter((d) => d.colaborador === colaborador);
  const irregularidades = (dados.data?.irregularidades ?? []).filter(
    (i) => i.colaborador === colaborador,
  );
  const banco = (dados.data?.banco ?? []).filter((b) => b.colaborador === colaborador);
  const setorDe = setores(irregularidades, banco);
  const cadastro = irregularidades.find((i) => i.cpf) ?? irregularidades[0];
  const nome = dias[0]?.nome ?? cadastro?.nome ?? banco[0]?.nome ?? colaborador;
  const r = resumoRh(dias, irregularidades);
  const meses = mesAMes(dias, irregularidades);
  const lista = diasQueContam(dias, irregularidades);

  return (
    <div className="space-y-8">
      <Link to="/gestao/rh" className="text-sm font-medium underline">
        ← Voltar ao painel de RH
      </Link>

      <Painel>
        <h2 className="text-2xl font-bold uppercase">{nome}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Unidade", unidade.nome],
            ["Setor", setorDe(colaborador)],
            ["Cargo", cadastro?.cargo || "—"],
            ["CPF", cadastro?.cpf || "—"],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="eyebrow text-muted-foreground">{rotulo}</dt>
              <dd className="mt-1 font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 grid max-w-md grid-cols-2 gap-4">
          <Campo label="De">
            <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo label="Até">
            <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Campo>
        </div>
      </Painel>

      {dados.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : dados.error ? (
        <Painel>
          <Vazio>Não foi possível carregar o RH: {dados.error.message}</Vazio>
        </Painel>
      ) : dias.length === 0 && irregularidades.length === 0 ? (
        <Painel>
          <Vazio>Nenhum dado de RH desta pessoa neste período.</Vazio>
        </Painel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Cartao
              rotulo="Horas trabalhadas"
              valor={minParaHoras(r.minutos)}
              detalhe={`${r.diasTrabalhados} dias trabalhados`}
              className="bg-ink text-cream"
            />
            <Cartao
              rotulo="Faltas sem justificativa"
              valor={r.faltas}
              className={r.faltas ? "bg-destructive text-destructive-foreground" : "bg-card"}
            />
            <Cartao
              rotulo="Atrasos"
              valor={r.atrasos}
              detalhe={`${minParaHoras(r.minutosAtraso)} descontados`}
              className={r.atrasos ? "bg-amber-400 text-black" : "bg-card"}
            />
            <Cartao
              rotulo="Pontualidade"
              valor={formatarPct(r.pontualidade)}
              className="bg-secondary text-secondary-foreground"
            />
            <Cartao rotulo="Atestados" valor={r.atestados} detalhe="dias com atestado no ponto" />
            <Cartao rotulo="Horas extras" valor={minParaHoras(r.minutosExtras)} />
            <Cartao
              rotulo="Banco de horas"
              valor={banco[0] ? minParaHoras(banco[0].saldo) : "—"}
              detalhe={
                banco[0]
                  ? `saldo em ${formatData(banco[0].referencia)}`
                  : "sem banco de horas importado"
              }
            />
          </div>

          <Painel titulo="Mês a mês">
            <ChartContainer config={grafico} className="aspect-auto h-64 w-full">
              <ComposedChart
                data={meses.map((m) => ({
                  mes: nomeDoMes(m.mes),
                  horas: Math.round(m.minutos / 6) / 10,
                  faltas: m.faltas,
                  atrasos: m.atrasos,
                }))}
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                <YAxis yAxisId="horas" tickLine={false} axisLine={false} width={40} />
                <YAxis
                  yAxisId="qtd"
                  orientation="right"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  yAxisId="qtd"
                  dataKey="faltas"
                  fill="var(--color-faltas)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="qtd"
                  dataKey="atrasos"
                  fill="var(--color-atrasos)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="horas"
                  dataKey="horas"
                  stroke="var(--color-horas)"
                  strokeWidth={2}
                  dot
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
            <div className="mt-6">
              <Tabela
                colunas={[
                  "Mês",
                  "Horas",
                  "Faltas",
                  "Atrasos",
                  "Min. atraso",
                  "Pontualidade",
                  "Atestados",
                ]}
                linhas={meses.map((m) => [
                  nomeDoMes(m.mes),
                  minParaHoras(m.minutos),
                  m.faltas,
                  m.atrasos,
                  minParaHoras(m.minutosAtraso),
                  formatarPct(m.pontualidade),
                  m.atestados,
                ])}
              />
            </div>
          </Painel>

          <Painel titulo="Dias que contam">
            {lista.length === 0 ? (
              <Vazio>Sem faltas, atrasos, atestados, férias ou abonos no período.</Vazio>
            ) : (
              <ul className="divide-y">
                {lista.map((d) => (
                  <li
                    key={`${d.data}-${d.tipo}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span className="font-semibold tabular-nums">{formatData(d.data)}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{d.observacao}</span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        pilula[d.tipo] ?? "bg-muted",
                      )}
                    >
                      {d.tipo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </>
      )}
    </div>
  );
}
