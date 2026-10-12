import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import {
  antecedencia,
  CATEGORIAS_MANUTENCAO,
  formatData,
  hoje,
  manutencaoPadrao,
  proximaInspecao,
  situacao,
  uid,
  ultimaInspecao,
  useColecao,
  type Inspecao,
  type ItemManutencao,
  type Situacao,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/manutencao")({
  component: Manutencao,
});

function Manutencao() {
  const [itens, salvar] = useColecao<ItemManutencao>("manutencao", manutencaoPadrao);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_MANUTENCAO[0]!);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", periodicidade: "30" });

  const status = (i: ItemManutencao): { prox: string | null; s: Situacao } => {
    const prox = proximaInspecao(i);
    return { prox, s: prox ? situacao(prox, antecedencia(i.periodicidade_dias)) : "vencido" };
  };
  const pendentes = (cat: string) =>
    itens.filter((i) => i.categoria === cat && status(i).s !== "ok").length;
  const daCategoria = itens.filter((i) => i.categoria === categoria);

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.nome.trim()) return;
    salvar((l) => [
      ...l,
      {
        id: uid(),
        categoria,
        nome: novo.nome.trim(),
        periodicidade_dias: Number(novo.periodicidade) || 30,
        historico: [],
      },
    ]);
    setNovo({ nome: "", periodicidade: novo.periodicidade });
  }

  function registrar(id: string, insp: Inspecao) {
    salvar((l) =>
      l.map((i) =>
        i.id === id
          ? { ...i, historico: [insp, ...i.historico].sort((a, b) => b.data.localeCompare(a.data)) }
          : i,
      ),
    );
    setRegistrando(null);
    toast.success(
      insp.resultado === "ok" ? "Inspeção registrada" : "Inspeção registrada com problema",
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIAS_MANUTENCAO.map((c) => {
          const n = pendentes(c);
          return (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${c === categoria ? "border-ink bg-ink text-cream" : "bg-card hover:bg-background"}`}
            >
              {c}
              {n > 0 && (
                <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Painel titulo={categoria}>
        {daCategoria.length === 0 ? (
          <Vazio>Nenhum item nesta categoria.</Vazio>
        ) : (
          <div className="divide-y">
            {daCategoria.map((i) => {
              const { prox, s } = status(i);
              const problema = i.historico[0]?.resultado === "problema";
              return (
                <div key={i.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{i.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        A cada {i.periodicidade_dias} dias · última: {formatData(ultimaInspecao(i))}{" "}
                        · próxima: {formatData(prox)}
                        {problema && (
                          <span className="font-semibold text-destructive">
                            {" "}
                            · último resultado: problema
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SituacaoBadge situacao={s} vencimento={prox} />
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => setRegistrando(registrando === i.id ? null : i.id)}
                      >
                        Registrar inspeção
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAberto(aberto === i.id ? null : i.id)}
                      >
                        Histórico ({i.historico.length})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditando(editando === i.id ? null : i.id)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          confirm("Excluir este item e seu histórico?") &&
                          salvar((l) => l.filter((x) => x.id !== i.id))
                        }
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {editando === i.id && (
                    <EditarItem
                      item={i}
                      onSalvar={(novo) => {
                        salvar((l) => l.map((x) => (x.id === novo.id ? novo : x)));
                        setEditando(null);
                        toast.success("Item atualizado");
                      }}
                      onCancelar={() => setEditando(null)}
                    />
                  )}
                  {registrando === i.id && (
                    <FormInspecao onSalvar={(insp) => registrar(i.id, insp)} />
                  )}
                  {aberto === i.id && (
                    <ul className="mt-3 space-y-1 rounded-2xl bg-muted p-4 text-sm">
                      {i.historico.length === 0 && (
                        <li className="text-muted-foreground">Sem inspeções registradas.</li>
                      )}
                      {i.historico.map((h, idx) => (
                        <li key={idx}>
                          <span className="font-semibold">{formatData(h.data)}</span> ·{" "}
                          {h.resultado === "ok" ? (
                            "OK"
                          ) : (
                            <span className="text-destructive">Problema</span>
                          )}
                          {h.responsavel && ` · ${h.responsavel}`}
                          {h.obs && ` · ${h.obs}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={adicionar} className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-4">
          <Campo label={`Novo item em ${categoria}`} className="sm:col-span-2">
            <Input
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              required
            />
          </Campo>
          <Campo label="Periodicidade (dias)">
            <Input
              type="number"
              min={1}
              value={novo.periodicidade}
              onChange={(e) => setNovo({ ...novo, periodicidade: e.target.value })}
            />
          </Campo>
          <div className="flex items-end">
            <Button type="submit" variant="outline" className="w-full rounded-full">
              Adicionar item
            </Button>
          </div>
        </form>
      </Painel>
    </div>
  );
}

function FormInspecao({ onSalvar }: { onSalvar: (i: Inspecao) => void }) {
  const [f, setF] = useState<Inspecao>({ data: hoje(), resultado: "ok", responsavel: "", obs: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(f);
      }}
      className="mt-3 grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-5"
    >
      <Campo label="Data">
        <Input
          type="date"
          value={f.data}
          max={hoje()}
          onChange={(e) => setF({ ...f, data: e.target.value })}
          required
        />
      </Campo>
      <Campo label="Resultado">
        <Seletor
          opcoes={["OK", "Problema encontrado"]}
          value={f.resultado === "ok" ? "OK" : "Problema encontrado"}
          onChange={(e) => setF({ ...f, resultado: e.target.value === "OK" ? "ok" : "problema" })}
        />
      </Campo>
      <Campo label="Responsável">
        <Input
          value={f.responsavel}
          onChange={(e) => setF({ ...f, responsavel: e.target.value })}
        />
      </Campo>
      <Campo label="Observação">
        <Input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
      </Campo>
      <div className="flex items-end">
        <Button type="submit" className="w-full rounded-full">
          Salvar
        </Button>
      </div>
    </form>
  );
}

function EditarItem({
  item,
  onSalvar,
  onCancelar,
}: {
  item: ItemManutencao;
  onSalvar: (i: ItemManutencao) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({
    nome: item.nome,
    categoria: item.categoria,
    dias: String(item.periodicidade_dias),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dias = Number(f.dias);
        if (!f.nome.trim()) return void toast.error("Informe o nome do item.");
        if (!Number.isInteger(dias) || dias < 1) return void toast.error("Periodicidade inválida.");
        onSalvar({
          ...item,
          nome: f.nome.trim(),
          categoria: f.categoria,
          periodicidade_dias: dias,
        });
      }}
      className="mt-3 grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-5"
    >
      <Campo label="Item" className="sm:col-span-2">
        <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
      </Campo>
      <Campo label="Categoria">
        <Seletor
          opcoes={CATEGORIAS_MANUTENCAO}
          value={f.categoria}
          onChange={(e) => setF({ ...f, categoria: e.target.value })}
        />
      </Campo>
      <Campo label="Periodicidade (dias)">
        <Input
          type="number"
          min={1}
          value={f.dias}
          onChange={(e) => setF({ ...f, dias: e.target.value })}
        />
      </Campo>
      <div className="flex items-end gap-2">
        <Button type="submit" className="rounded-full">
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
