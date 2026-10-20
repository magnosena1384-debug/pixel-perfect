import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Cartao, Painel, PilulaSituacao, Seletor, Vazio } from "@/components/gestao/ui";
import { AvisoSerieRepetida } from "@/components/patrimonio/AvisoSerieRepetida";
import { FormularioBem } from "@/components/patrimonio/FormularioBem";
import { formatBRL } from "@/lib/auth";
import { formatData, hoje, useUnidadesCom } from "@/lib/gestao";
import {
  baixarBem,
  editarBem,
  MOTIVOS_BAIXA,
  transferirBem,
  useBem,
  useEmpresasDoGrupo,
  type DadosBem,
  type Repetido,
} from "@/lib/patrimonio/dados";
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
  const empresas = useEmpresasDoGrupo();
  const [painel, setPainel] = useState<"editar" | "transferir" | "baixa" | null>(null);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_BAIXA[0].valor);
  const [dataBaixa, setDataBaixa] = useState(hoje());
  const [obsBaixa, setObsBaixa] = useState("");
  const [destino, setDestino] = useState("");
  const [observacao, setObservacao] = useState("");
  const [gravando, setGravando] = useState(false);
  const [repetido, setRepetido] = useState<{ dados: DadosBem; bem: Repetido } | null>(null);

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

  const empresa =
    empresas.data?.find((e) => e.id === bem.unidadeId)?.nome ??
    unidades.find((u) => u.id === bem.unidadeId)?.nome ??
    "";
  const destinos = (empresas.data ?? []).filter((e) => e.id !== bem.unidadeId);
  const destinoEscolhido = destinos.find((e) => e.id === destino) ?? destinos[0];
  const podeGerenciar = gerencia.some((u) => u.id === bem.unidadeId);
  const editavel = podeGerenciar && bem.situacao !== "em_transito" && bem.situacao !== "baixado";
  const d = depreciacao(bem, hoje());

  async function gravarEdicao(dados: DadosBem, confirmar = false) {
    if (!bem) return;
    setGravando(true);
    try {
      const r = await editarBem(bem.id, dados, confirmar);
      if (r.repetido) {
        setRepetido({ dados, bem: r.repetido });
        return;
      }
      setRepetido(null);
      toast.success("Bem atualizado");
      setPainel(null);
      void qc.invalidateQueries({ queryKey: ["patrimonio"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  }

  async function agir(fazer: () => Promise<unknown>, mensagem: string) {
    setGravando(true);
    try {
      await fazer();
      toast.success(mensagem);
      setPainel(null);
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
              {editavel && (
                <>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPainel(painel === "editar" ? null : "editar")}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPainel(painel === "transferir" ? null : "transferir")}
                  >
                    Transferir
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => setPainel(painel === "baixa" ? null : "baixa")}
                  >
                    Dar baixa
                  </Button>
                </>
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
              ? [
                  [
                    "Baixa",
                    `${formatData(bem.baixaData)} · ${MOTIVOS_BAIXA.find((m) => m.valor === bem.baixaMotivo)?.rotulo ?? ""}`,
                  ],
                ]
              : []),
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="eyebrow text-muted-foreground">{rotulo}</dt>
              <dd className="mt-1 font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
      </Painel>

      {painel === "editar" && (
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
            aoGravar={(dados) => void gravarEdicao(dados)}
            antesDosCampos={
              repetido && (
                <AvisoSerieRepetida
                  bem={repetido.bem}
                  gravando={gravando}
                  rotuloConfirmar="Gravar mesmo assim"
                  aoConfirmar={() => void gravarEdicao(repetido.dados, true)}
                  aoCorrigir={() => setRepetido(null)}
                />
              )
            }
          />
          <Button variant="ghost" className="mt-2" onClick={() => setPainel(null)}>
            Cancelar
          </Button>
        </Painel>
      )}

      {painel === "transferir" && (
        <Painel titulo="Transferir para outra empresa">
          <p className="mb-4 text-sm text-muted-foreground">
            O bem fica em trânsito e continua de {empresa} até a empresa de destino confirmar o
            recebimento. O tombamento e a etiqueta não mudam.
          </p>
          {!destinoEscolhido ? (
            <Vazio>Não há outra empresa no grupo para receber o bem.</Vazio>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void agir(
                  () => transferirBem(bem.id, destinoEscolhido.id, observacao),
                  `Enviado para ${destinoEscolhido.nome}; aguardando recebimento`,
                );
              }}
            >
              <Campo label="Empresa de destino">
                <Seletor
                  opcoes={destinos.map((e) => ({ valor: e.id, rotulo: e.nome }))}
                  value={destinoEscolhido.id}
                  onChange={(e) => setDestino(e.target.value)}
                />
              </Campo>
              <Campo label="Observação (opcional)">
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </Campo>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" className="rounded-full" disabled={gravando}>
                  {gravando ? "Enviando…" : `Enviar para ${destinoEscolhido.nome}`}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPainel(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </Painel>
      )}

      {painel === "baixa" && (
        <Painel titulo="Dar baixa">
          <p className="mb-4 text-sm text-muted-foreground">
            O bem para de depreciar na data da baixa, sai do inventário e das etiquetas e continua
            no histórico. A baixa não pode ser desfeita por aqui.
          </p>
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirm(`Dar baixa no bem ${formatarTombamento(bem.tombamento)}?`)) return;
              void agir(() => baixarBem(bem.id, motivo, dataBaixa, obsBaixa), "Baixa registrada");
            }}
          >
            <Campo label="Motivo">
              <Seletor
                opcoes={MOTIVOS_BAIXA}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
            <Campo label="Data da baixa">
              <Input
                type="date"
                value={dataBaixa}
                min={bem.dataCompra}
                max={hoje()}
                onChange={(e) => setDataBaixa(e.target.value)}
                required
              />
            </Campo>
            <Campo label="Observação (opcional)">
              <Input value={obsBaixa} onChange={(e) => setObsBaixa(e.target.value)} />
            </Campo>
            <div className="flex gap-2 sm:col-span-3">
              <Button
                type="submit"
                variant="destructive"
                className="rounded-full"
                disabled={gravando}
              >
                {gravando ? "Gravando…" : "Confirmar baixa"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPainel(null)}>
                Cancelar
              </Button>
            </div>
          </form>
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
