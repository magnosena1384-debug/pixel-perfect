import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, Vazio } from "@/components/gestao/ui";
import { formatBRL } from "@/lib/auth";
import {
  formatData,
  hoje,
  horaAtual,
  PAGAMENTOS,
  PRODUTOS,
  reaisParaCentavos,
  uid,
  useColecao,
  type Venda,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/vendas")({
  component: Vendas,
});

const novo = () => ({
  data: hoje(),
  hora: horaAtual(),
  colaborador: "",
  produto: PRODUTOS[0]!,
  litros: "",
  valor: "",
  pagamento: PAGAMENTOS[0]!,
  obs: "",
});

function Vendas() {
  const [vendas, salvar] = useColecao<Venda>("vendas");
  const [form, setForm] = useState(novo);
  const [mes, setMes] = useState(hoje().slice(0, 7));

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const valor_centavos = reaisParaCentavos(form.valor);
    if (valor_centavos <= 0) {
      toast.error("Informe o valor da venda.");
      return;
    }
    const venda: Venda = {
      id: uid(),
      data: form.data,
      hora: form.hora,
      colaborador: form.colaborador.trim(),
      produto: form.produto,
      litros: form.litros ? Number(form.litros.replace(",", ".")) : null,
      valor_centavos,
      pagamento: form.pagamento,
      obs: form.obs,
    };
    salvar((l) => [venda, ...l]);
    // Mantém data e colaborador para agilizar lançamentos em sequência.
    setForm({ ...novo(), data: form.data, colaborador: form.colaborador });
    toast.success("Venda registrada");
  }

  const colaboradores = [
    ...new Set(vendas.map((v) => v.colaborador).filter((x): x is string => !!x)),
  ];

  const doMes = vendas
    .filter((v) => v.data.startsWith(mes))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.hora ?? "").localeCompare(a.hora ?? ""));
  const total = doMes.reduce((s, v) => s + v.valor_centavos, 0);
  const litros = doMes.reduce((s, v) => s + (v.litros ?? 0), 0);
  const totalHoje = vendas
    .filter((v) => v.data === hoje())
    .reduce((s, v) => s + v.valor_centavos, 0);
  const porProduto = PRODUTOS.map((p) => ({
    p,
    v: doMes.filter((x) => x.produto === p).reduce((s, x) => s + x.valor_centavos, 0),
  }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const set =
    (k: keyof ReturnType<typeof novo>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-primary p-6">
          <p className="eyebrow opacity-70">Hoje</p>
          <p className="mt-2 text-3xl font-bold">{formatBRL(totalHoje)}</p>
        </div>
        <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground">
          <p className="eyebrow opacity-70">Total do mês</p>
          <p className="mt-2 text-3xl font-bold">{formatBRL(total)}</p>
        </div>
        <div className="rounded-3xl bg-card p-6">
          <p className="eyebrow opacity-70">Litros no mês</p>
          <p className="mt-2 text-3xl font-bold">
            {litros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
          </p>
        </div>
      </div>

      <Painel titulo="Registrar venda">
        <form onSubmit={adicionar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Campo label="Data">
            <Input type="date" value={form.data} onChange={set("data")} required />
          </Campo>
          <Campo label="Hora">
            <Input type="time" value={form.hora} onChange={set("hora")} required />
          </Campo>
          <Campo label="Produto" className="lg:col-span-2">
            <Seletor opcoes={PRODUTOS} value={form.produto} onChange={set("produto")} />
          </Campo>
          <Campo label="Litros">
            <Input
              inputMode="decimal"
              placeholder="0"
              value={form.litros}
              onChange={set("litros")}
            />
          </Campo>
          <Campo label="Valor (R$)">
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor}
              onChange={set("valor")}
              required
            />
          </Campo>
          <Campo label="Pagamento">
            <Seletor opcoes={PAGAMENTOS} value={form.pagamento} onChange={set("pagamento")} />
          </Campo>
          <Campo label="Colaborador">
            <Input
              list="colaboradores"
              value={form.colaborador}
              onChange={set("colaborador")}
              required
            />
            <datalist id="colaboradores">
              {colaboradores.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Observação" className="sm:col-span-2 lg:col-span-3">
            <Input value={form.obs} onChange={set("obs")} />
          </Campo>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-full">
              Adicionar
            </Button>
          </div>
        </form>
      </Painel>

      <div className="grid gap-8 lg:grid-cols-3">
        <Painel titulo="Por produto">
          {porProduto.length === 0 ? (
            <Vazio>Sem vendas no mês.</Vazio>
          ) : (
            <ul className="space-y-3">
              {porProduto.map(({ p, v }) => (
                <li key={p}>
                  <div className="flex justify-between text-sm">
                    <span>{p}</span>
                    <span className="font-semibold">{formatBRL(v)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-forest"
                      style={{ width: `${(v / total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel
          titulo="Lançamentos"
          className="lg:col-span-2"
          acao={
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
            />
          }
        >
          {doMes.length === 0 ? (
            <Vazio>Nenhuma venda neste mês.</Vazio>
          ) : (
            <div className="divide-y">
              {doMes.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold">
                      {v.produto}
                      {v.litros ? ` · ${v.litros.toLocaleString("pt-BR")} L` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatData(v.data)}
                      {v.hora ? ` ${v.hora}` : ""} · {v.pagamento}
                      {v.colaborador ? ` · ${v.colaborador}` : ""}
                      {v.obs ? ` · ${v.obs}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatBRL(v.valor_centavos)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        confirm("Excluir esta venda?") &&
                        salvar((l) => l.filter((x) => x.id !== v.id))
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>
    </div>
  );
}
