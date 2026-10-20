import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { hoje } from "@/lib/gestao";
import { useDadosRh, useUnidadesCom } from "@/lib/rh/dados";
import { resumoRh } from "@/lib/rh/indicadores";
import { minParaHoras } from "@/lib/rh/planilha";

export const Route = createFileRoute("/gestao/rh/")({
  component: PainelRh,
});

const TODAS = "Todas";
const TODOS = "Todos";

const pct = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function PainelRh() {
  const { unidades } = useUnidadesCom("rh");
  const { unidades: podeImportar } = useUnidadesCom("rh-importar");
  const [de, setDe] = useState(`${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje());
  const [unidade, setUnidade] = useState(TODAS);
  const [colaborador, setColaborador] = useState(TODOS);

  const escolhidas = unidade === TODAS ? unidades : unidades.filter((u) => u.nome === unidade);
  const dados = useDadosRh(
    de,
    ate,
    escolhidas.map((u) => u.id),
  );
  const todosDias = dados.data?.dias ?? [];
  const todasIrr = dados.data?.irregularidades ?? [];
  const colaboradores = [...new Set([...todosDias, ...todasIrr].map((x) => x.colaborador))].sort();
  const daPessoa = <T extends { colaborador: string }>(x: T) =>
    colaborador === TODOS || x.colaborador === colaborador;
  const dias = todosDias.filter(daPessoa);
  const irregularidades = todasIrr.filter(daPessoa);
  const r = resumoRh(dias, irregularidades);
  const vazio = dias.length === 0 && irregularidades.length === 0;

  return (
    <div className="space-y-8">
      <Painel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            valor={pct(r.pontualidade)}
            detalhe={`${r.diasTrabalhados} dias trabalhados`}
            className="bg-secondary text-secondary-foreground"
          />
          <Cartao rotulo="Atestados" valor={r.atestados} detalhe="dias com atestado no ponto" />
        </div>
      )}
    </div>
  );
}
