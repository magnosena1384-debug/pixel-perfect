import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import {
  diasAte,
  formatData,
  hoje,
  PRODUTOS,
  reaisParaCentavos,
  uid,
  useColecao,
  type Pedido,
  type PedidoStatus,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/pedidos")({
  component: Pedidos,
});

const STATUS: { v: PedidoStatus; label: string; cls: string }[] = [
  { v: "solicitado", label: "Solicitado", cls: "bg-muted" },
  { v: "confirmado", label: "Confirmado", cls: "bg-secondary text-secondary-foreground" },
  { v: "entregue", label: "Entregue", cls: "bg-primary" },
  { v: "cancelado", label: "Cancelado", cls: "bg-destructive text-destructive-foreground" },
];

const novo = () => ({
  data: hoje(),
  fornecedor: "",
  produto: PRODUTOS[0]!,
  quantidade: "",
  unidade: "L",
  valor: "",
  previsao_entrega: "",
  nota_fiscal: "",
});

function Pedidos() {
  const [pedidos, salvar] = useColecao<Pedido>("pedidos");
  const [form, setForm] = useState(novo);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fornecedor.trim()) {
      toast.error("Informe o fornecedor.");
      return;
    }
    const p: Pedido = {
      id: uid(),
      data: form.data,
      fornecedor: form.fornecedor.trim(),
      produto: form.produto,
      quantidade: Number(form.quantidade.replace(",", ".")) || 0,
      unidade: form.unidade,
      valor_centavos: reaisParaCentavos(form.valor),
      previsao_entrega: form.previsao_entrega,
      nota_fiscal: form.nota_fiscal,
      status: "solicitado",
    };
    salvar((l) => [p, ...l]);
    setForm(novo());
    toast.success("Pedido criado");
  }

  const mudar = (id: string, status: PedidoStatus) =>
    salvar((l) => l.map((p) => (p.id === id ? { ...p, status } : p)));
  const set =
    (k: keyof ReturnType<typeof novo>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const abertos = (p: Pedido) => p.status === "solicitado" || p.status === "confirmado";
  const lista = pedidos
    .filter((p) => filtro === "todos" || abertos(p))
    .sort((a, b) => b.data.localeCompare(a.data));
  const emAberto = pedidos.filter(abertos);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-primary p-6">
          <p className="eyebrow opacity-70">Em aberto</p>
          <p className="mt-2 text-3xl font-bold">{emAberto.length}</p>
        </div>
        <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground">
          <p className="eyebrow opacity-70">Valor em aberto</p>
          <p className="mt-2 text-3xl font-bold">
            {formatBRL(emAberto.reduce((s, p) => s + p.valor_centavos, 0))}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-6">
          <p className="eyebrow opacity-70">Entregas atrasadas</p>
          <p className="mt-2 text-3xl font-bold">
            {emAberto.filter((p) => p.previsao_entrega && diasAte(p.previsao_entrega) < 0).length}
          </p>
        </div>
      </div>

      <Painel titulo="Novo pedido">
        <form onSubmit={adicionar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Data do pedido">
            <Input type="date" value={form.data} onChange={set("data")} required />
          </Campo>
          <Campo label="Fornecedor / distribuidora">
            <Input value={form.fornecedor} onChange={set("fornecedor")} required />
          </Campo>
          <Campo label="Produto">
            <Seletor opcoes={PRODUTOS} value={form.produto} onChange={set("produto")} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Quantidade">
              <Input inputMode="decimal" value={form.quantidade} onChange={set("quantidade")} />
            </Campo>
            <Campo label="Unidade">
              <Seletor
                opcoes={["L", "un", "cx", "kg"]}
                value={form.unidade}
                onChange={set("unidade")}
              />
            </Campo>
          </div>
          <Campo label="Valor total (R$)">
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor}
              onChange={set("valor")}
            />
          </Campo>
          <Campo label="Previsão de entrega">
            <Input type="date" value={form.previsao_entrega} onChange={set("previsao_entrega")} />
          </Campo>
          <Campo label="Nota fiscal">
            <Input value={form.nota_fiscal} onChange={set("nota_fiscal")} />
          </Campo>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-full">
              Criar pedido
            </Button>
          </div>
        </form>
      </Painel>

      <Painel
        titulo="Pedidos"
        acao={
          <Seletor
            opcoes={["Em aberto", "Todos"]}
            value={filtro === "abertos" ? "Em aberto" : "Todos"}
            onChange={(e) => setFiltro(e.target.value === "Todos" ? "todos" : "abertos")}
            className="w-36"
          />
        }
      >
        {lista.length === 0 ? (
          <Vazio>Nenhum pedido.</Vazio>
        ) : (
          <div className="divide-y">
            {lista.map((p) => {
              const atrasado = abertos(p) && p.previsao_entrega && diasAte(p.previsao_entrega) < 0;
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">
                      {p.fornecedor} · {p.produto}{" "}
                      {p.quantidade ? `· ${p.quantidade.toLocaleString("pt-BR")} ${p.unidade}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pedido {formatData(p.data)} · entrega {formatData(p.previsao_entrega)}
                      {atrasado && (
                        <span className="font-semibold text-destructive"> (atrasada)</span>
                      )}
                      {p.nota_fiscal && ` · NF ${p.nota_fiscal}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatBRL(p.valor_centavos)}</span>
                    <select
                      value={p.status}
                      onChange={(e) => mudar(p.id, e.target.value as PedidoStatus)}
                      className={`rounded-full border-0 px-3 py-1 text-xs font-semibold ${STATUS.find((s) => s.v === p.status)?.cls}`}
                    >
                      {STATUS.map((s) => (
                        <option key={s.v} value={s.v}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        confirm("Excluir este pedido?") &&
                        salvar((l) => l.filter((x) => x.id !== p.id))
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Painel>
    </div>
  );
}
