import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { hoje } from "@/lib/gestao";
import { usePontoRh, useUnidadesCom } from "@/lib/rh/dados";
import { resumoRh } from "@/lib/rh/indicadores";
import { minParaHoras } from "@/lib/rh/planilha";

export const Route = createFileRoute("/gestao/rh/")({
  component: PainelRh,
});

const TODAS = "Todas";

function PainelRh() {
  const { unidades } = useUnidadesCom("rh");
  const { unidades: podeImportar } = useUnidadesCom("rh-importar");
  const [de, setDe] = useState(`${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje());
  const [unidade, setUnidade] = useState(TODAS);

  const escolhidas = unidade === TODAS ? unidades : unidades.filter((u) => u.nome === unidade);
  const ponto = usePontoRh(
    de,
    ate,
    escolhidas.map((u) => u.id),
  );
  const dias = ponto.data ?? [];
  const resumo = resumoRh(dias);

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
              onChange={(e) => setUnidade(e.target.value)}
            />
          </Campo>
        </div>
      </Painel>

      {ponto.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : ponto.error ? (
        <Painel>
          <Vazio>Não foi possível carregar o RH: {ponto.error.message}</Vazio>
        </Painel>
      ) : dias.length === 0 ? (
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
            valor={minParaHoras(resumo.minutos)}
            detalhe={`média de ${minParaHoras(resumo.mediaMinutos)} por colaborador · ${resumo.colaboradores} colaboradores`}
            className="bg-ink text-cream"
          />
        </div>
      )}
    </div>
  );
}
