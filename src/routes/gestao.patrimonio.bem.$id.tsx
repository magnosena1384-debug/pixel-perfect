import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Cartao, Painel, PilulaSituacao, Vazio } from "@/components/gestao/ui";
import { FormularioBem } from "@/components/patrimonio/FormularioBem";
import { formatBRL } from "@/lib/auth";
import { formatData, hoje, useUnidadesCom } from "@/lib/gestao";
import { editarBem, useBem, type DadosBem } from "@/lib/patrimonio/dados";
import { depreciacao, formatarTombamento } from "@/lib/patrimonio/regras";

export const Route = createFileRoute("/gestao/patrimonio/bem/$id")({
  component: Ficha,
});

const EVENTOS: Record<string, string> = {
  cadastro: "Cadastrado",
  edicao: "Editado",
  etiqueta: "Etiqueta impressa",
  inventario: "Inventário",
  transferencia_envio: "Enviado",
  transferencia_recebida: "Recebido",
  transferencia_cancelada: "Transferência cancelada",
  baixa: "Baixa",
};

function Ficha() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const consulta = useBem(id);
  const { unidades } = useUnidadesCom("patrimonio");
  const { unidades: gerencia } = useUnidadesCom("patrimonio-gerenciar");
  const [editando, setEditando] = useState(false);
  const [gravando, setGravando] = useState(false);

  if (consulta.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (consulta.error)
    return (
      <Painel>
        <Vazio>Não foi possível carregar o bem: {consulta.error.message}</Vazio>
      </Painel>
    );
  const bem = consulta.data?.bem;
  if (!bem)
    return (
      <Painel>
        <p>Você não tem acesso ao Patrimônio nesta empresa, ou o bem não existe.</p>
      </Painel>
    );

  const empresa = unidades.find((u) => u.id === bem.unidadeId)?.nome ?? "";
  const podeGerenciar = gerencia.some((u) => u.id === bem.unidadeId);
  const editavel = podeGerenciar && bem.situacao !== "em_transito" && bem.situacao !== "baixado";
  const d = depreciacao(bem, hoje());

  async function gravar(dados: DadosBem) {
    setGravando(true);
    try {
      await editarBem(bem!.id, dados);
      toast.success("Bem atualizado");
      setEditando(false);
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <div className="space-y-8">
      <Link to="/gestao/patrimonio" className="text-sm font-medium underline">
        ← Voltar aos bens
      </Link>

      <Painel
        acao={
          podeGerenciar && (
            <div className="flex flex-wrap gap-2">
              {editavel && !editando && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setEditando(true)}
                >
                  Editar
                </Button>
              )}
              {bem.situacao !== "baixado" && (
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/gestao/patrimonio/etiquetas" search={{ ids: bem.id }}>
                    Imprimir etiqueta
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      >
        <p className="font-mono text-3xl font-bold tabular-nums">
          {formatarTombamento(bem.tombamento)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold uppercase">{bem.nome}</h2>
          <PilulaSituacao situacao={bem.situacao} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Empresa", empresa],
            ["Setor", bem.setor || "—"],
            ["Categoria", bem.categoria],
            ["Marca / modelo", [bem.marca, bem.modelo].filter(Boolean).join(" ") || "—"],
            ["Nº de série", bem.numeroSerie || "—"],
            ["Data de compra", formatData(bem.dataCompra)],
            ["Vida útil", `${bem.vidaUtilAnos} anos`],
            ...(bem.baixaData
              ? [["Baixa", `${formatData(bem.baixaData)} · ${bem.baixaMotivo ?? ""}`]]
              : []),
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="eyebrow text-muted-foreground">{rotulo}</dt>
              <dd className="mt-1 font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
      </Painel>

      {editando && (
        <Painel titulo="Editar bem">
          <p className="mb-4 text-sm text-muted-foreground">
            A empresa não muda aqui: para levar o bem a outra empresa, use a transferência.
          </p>
          <FormularioBem
            inicial={{
              ...bem,
              situacao: bem.situacao === "com_defeito" ? "com_defeito" : "em_uso",
            }}
            comSituacao
            rotulo="Gravar"
            gravando={gravando}
            aoGravar={(dados) => void gravar(dados)}
          />
          <Button variant="ghost" className="mt-2" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        </Painel>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Cartao rotulo="Valor de compra" valor={formatBRL(bem.valorCompra)} />
        <Cartao
          rotulo="Depreciação acumulada"
          valor={formatBRL(d.acumulada)}
          detalhe={`${d.meses} meses · ${formatBRL(d.mensal)} por mês`}
        />
        <Cartao rotulo="Valor atual" valor={formatBRL(d.atual)} className="bg-ink text-cream" />
      </div>

      <Painel titulo="Histórico">
        {!consulta.data?.historico.length ? (
          <Vazio>Sem histórico.</Vazio>
        ) : (
          <ul className="divide-y">
            {consulta.data.historico.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-semibold">{EVENTOS[h.evento] ?? h.evento}</span>
                  {h.detalhe ? ` · ${h.detalhe}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {new Date(h.quando).toLocaleString("pt-BR")}
                  {h.quem_nome ? ` · ${h.quem_nome}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
