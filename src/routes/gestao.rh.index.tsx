import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Campo, Cartao, Painel, Seletor, Tabela, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import { formatData, hoje } from "@/lib/gestao";
import { useDadosRh, useUnidadesCom, useVendasRh } from "@/lib/rh/dados";
import {
  casarVendas,
  horasPorSetor,
  porColaborador,
  porUnidade,
  formatarPct,
  resumoRh,
  saldoBanco,
  setores,
} from "@/lib/rh/indicadores";
import { minParaHoras } from "@/lib/rh/planilha";

export const Route = createFileRoute("/gestao/rh/")({
  component: PainelRh,
});

const TODAS = "Todas";
const TODOS = "Todos";

const grafico = { minutos: { label: "Horas", color: "var(--chart-2)" } } satisfies ChartConfig;

function PainelRh() {
  const { unidades } = useUnidadesCom("rh");
  const { unidades: podeImportar } = useUnidadesCom("rh-importar");
  const [de, setDe] = useState(`${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje());
  const [unidade, setUnidade] = useState(TODAS);
  const [setor, setSetor] = useState(TODOS);
  const [colaborador, setColaborador] = useState(TODOS);

  const escolhidas = unidade === TODAS ? unidades : unidades.filter((u) => u.nome === unidade);
  const dados = useDadosRh(
    de,
    ate,
    escolhidas.map((u) => u.id),
  );
  const todosDias = dados.data?.dias ?? [];
  const todasIrr = dados.data?.irregularidades ?? [];
  const todoBanco = dados.data?.banco ?? [];
  const setorDe = setores(todasIrr, todoBanco);

  const doSetor = <T extends { colaborador: string }>(x: T) =>
    setor === TODOS || setorDe(x.colaborador) === setor;
  const daPessoa = <T extends { colaborador: string }>(x: T) =>
    doSetor(x) && (colaborador === TODOS || x.colaborador === colaborador);
  const nomesSetores = [...new Set(todosDias.map((d) => setorDe(d.colaborador)))].sort();
  const colaboradores = [
    ...new Set([...todosDias, ...todasIrr].filter(doSetor).map((x) => x.colaborador)),
  ].sort();

  const dias = todosDias.filter(daPessoa);
  const irregularidades = todasIrr.filter(daPessoa);
  const banco = todoBanco.filter(daPessoa);
  const r = resumoRh(dias, irregularidades);
  const porSetor = horasPorSetor(dias, setorDe);
  const referencias = [...new Set(banco.map((b) => b.referencia))].sort();
  const nomeDaUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "";

  const vendas = useVendasRh(de, ate, escolhidas.length > 0);
  const pessoas = porColaborador(todosDias, todasIrr);
  const ticket = casarVendas(
    pessoas,
    (vendas.data ?? []).filter((v) => escolhidas.some((u) => u.id === v.unidadeId)),
  );
  const vazio = dias.length === 0 && irregularidades.length === 0;

  return (
    <div className="space-y-8">
      <Painel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="De">
            <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo label="Até">
            <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Campo>
          <Campo label="Unidade">
            <Seletor
              opcoes={[TODAS, ...unidades.map((u) => u.nome)]}
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setSetor(TODOS);
                setColaborador(TODOS);
              }}
            />
          </Campo>
          <Campo label="Setor">
            <Seletor
              opcoes={[TODOS, ...nomesSetores]}
              value={setor}
              onChange={(e) => {
                setSetor(e.target.value);
                setColaborador(TODOS);
              }}
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

      {dados.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : dados.error ? (
        <Painel>
          <Vazio>Não foi possível carregar o RH: {dados.error.message}</Vazio>
        </Painel>
      ) : vazio ? (
        <Painel>
          <Vazio>
            Nenhum dado de RH neste período.
            {podeImportar.length > 0 && (
              <>
                {" "}
                <Link to="/gestao/rh/importar" className="font-semibold underline">
                  Importar do QuarkRH
                </Link>
              </>
            )}
          </Vazio>
        </Painel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Cartao
              rotulo="Horas trabalhadas"
              valor={minParaHoras(r.minutos)}
              detalhe={`média de ${minParaHoras(r.mediaMinutos)} por colaborador · ${r.colaboradores} colaboradores`}
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
              detalhe={`${r.diasTrabalhados} dias trabalhados`}
              className="bg-secondary text-secondary-foreground"
            />
            <Cartao rotulo="Atestados" valor={r.atestados} detalhe="dias com atestado no ponto" />
            <Cartao rotulo="Horas extras" valor={minParaHoras(r.minutosExtras)} />
            <Cartao
              rotulo="Banco de horas"
              valor={banco.length ? minParaHoras(saldoBanco(banco)) : "—"}
              detalhe={
                banco.length
                  ? `saldo em ${referencias.map(formatData).join(", ")}`
                  : "sem banco de horas importado"
              }
            />
          </div>

          <Painel titulo="Horas por setor">
            <div className="grid gap-8 lg:grid-cols-2">
              <ChartContainer
                config={grafico}
                className="aspect-auto w-full"
                style={{ height: Math.max(160, porSetor.length * 48) }}
              >
                <BarChart data={porSetor} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="setor"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
                  />
                  <ChartTooltip
                    formatter={(v) => [minParaHoras(Number(v)), "Horas"]}
                    cursor={false}
                  />
                  <Bar
                    dataKey="minutos"
                    fill="var(--color-minutos)"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
              <Tabela
                colunas={["Setor", "Colaboradores", "Horas", "Média"]}
                linhas={porSetor.map((s) => [
                  s.setor,
                  s.colaboradores,
                  minParaHoras(s.minutos),
                  minParaHoras(s.media),
                ])}
              />
            </div>
          </Painel>

          {escolhidas.length > 1 && (
            <Painel titulo="Comparar postos">
              <Tabela
                colunas={[
                  "Unidade",
                  "Colaboradores",
                  "Horas",
                  "Média",
                  "Faltas",
                  "Atrasos",
                  "Min. atraso",
                  "Pontualidade",
                  "Atestados",
                ]}
                linhas={porUnidade(dias, irregularidades).map((u) => [
                  nomeDaUnidade(u.unidadeId),
                  u.colaboradores,
                  minParaHoras(u.minutos),
                  minParaHoras(u.mediaMinutos),
                  u.faltas,
                  u.atrasos,
                  minParaHoras(u.minutosAtraso),
                  formatarPct(u.pontualidade),
                  u.atestados,
                ])}
              />
            </Painel>
          )}

          <Painel titulo="Por colaborador">
            <Tabela
              colunas={[
                "Colaborador",
                ...(escolhidas.length > 1 ? ["Unidade"] : []),
                "Setor",
                "Horas",
                "Faltas",
                "Atrasos",
                "Min. atraso",
                "Pontualidade",
                "Atestados",
                "Ticket vendas",
              ]}
              linhas={porColaborador(dias, irregularidades).map((c) => {
                const venda = ticket.get(`${c.unidadeId}|${c.colaborador}`);
                return [
                  <Link
                    key="nome"
                    to="/gestao/rh/colaborador/$unidade/$colaborador"
                    params={{ unidade: c.unidadeId, colaborador: c.colaborador }}
                    className="underline-offset-2 hover:underline"
                  >
                    {c.nome}
                  </Link>,
                  ...(escolhidas.length > 1 ? [nomeDaUnidade(c.unidadeId)] : []),
                  setorDe(c.colaborador),
                  minParaHoras(c.minutos),
                  c.faltas,
                  c.atrasos,
                  minParaHoras(c.minutosAtraso),
                  formatarPct(c.pontualidade),
                  c.atestados,
                  venda ? formatBRL(Math.round(venda.ticket * 100)) : "—",
                ];
              })}
            />
            {vendas.error ? (
              <p className="mt-3 text-sm text-destructive">
                Não foi possível carregar o ticket de vendas: {vendas.error.message}
              </p>
            ) : (
              !vendas.isLoading &&
              !vendas.data?.length && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Ticket de vendas aparece quando os cupons do webPosto do período estão importados.
                </p>
              )
            )}
          </Painel>
        </>
      )}
    </div>
  );
}
