import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Campo, Painel, Seletor } from "@/components/gestao/ui";
import { AvisoSerieRepetida } from "@/components/patrimonio/AvisoSerieRepetida";
import { FormularioBem } from "@/components/patrimonio/FormularioBem";
import { useUnidadesCom } from "@/lib/gestao";
import { cadastrarBem, type DadosBem, type Repetido } from "@/lib/patrimonio/dados";
import { formatarTombamento } from "@/lib/patrimonio/regras";

export const Route = createFileRoute("/gestao/patrimonio/novo")({
  component: Novo,
});

function Novo() {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const { unidades, isLoading } = useUnidadesCom("patrimonio-gerenciar");
  const [empresa, setEmpresa] = useState("");
  const [gravando, setGravando] = useState(false);
  const [repetido, setRepetido] = useState<{ dados: DadosBem; bem: Repetido } | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  const unidade = unidades.find((u) => u.id === empresa) ?? unidades[0];
  if (!unidade)
    return (
      <Painel>
        <p>Você não tem permissão para cadastrar bens em nenhuma empresa.</p>
      </Painel>
    );

  async function gravar(dados: DadosBem, confirmar = false) {
    if (!unidade) return;
    setGravando(true);
    try {
      const r = await cadastrarBem(unidade.id, dados, confirmar);
      if ("repetido" in r) {
        setRepetido({ dados, bem: r.repetido });
        return;
      }
      toast.success(`Bem ${formatarTombamento(r.tombamento)} cadastrado`);
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
      void navegar({ to: "/gestao/patrimonio/bem/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <Painel titulo="Cadastrar bem">
      <FormularioBem
        rotulo="Cadastrar"
        gravando={gravando}
        aoGravar={(d) => void gravar(d)}
        antesDosCampos={
          <>
            <Campo label="Empresa" className="max-w-sm">
              <Seletor
                opcoes={unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
                value={unidade.id}
                onChange={(e) => setEmpresa(e.target.value)}
                disabled={gravando}
              />
            </Campo>
            {repetido && (
              <AvisoSerieRepetida
                bem={repetido.bem}
                gravando={gravando}
                rotuloConfirmar="Cadastrar mesmo assim"
                aoConfirmar={() => void gravar(repetido.dados, true)}
                aoCorrigir={() => setRepetido(null)}
              />
            )}
          </>
        }
      />
    </Painel>
  );
}
