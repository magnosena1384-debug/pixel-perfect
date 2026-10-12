import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Painel, Seletor, SituacaoBadge, Vazio } from "@/components/gestao/ui";
import {
  DOCUMENTOS_SUGERIDOS,
  formatData,
  ORGAOS,
  situacao,
  uid,
  useColecao,
  type Documento,
} from "@/lib/gestao";

export const Route = createFileRoute("/gestao/regulacao")({
  component: Regulacao,
});

const novo = (orgao: string = ORGAOS[0]!) => ({
  orgao,
  nome: "",
  numero: "",
  emissao: "",
  validade: "",
  avisar_dias: "30",
  obs: "",
});

function Regulacao() {
  const [docs, salvar] = useColecao<Documento>("documentos");
  const [form, setForm] = useState(novo);
  const [editando, setEditando] = useState<string | null>(null);
  const [orgaoFiltro, setOrgaoFiltro] = useState("Todos");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    const doc: Documento = {
      ...form,
      id: editando ?? uid(),
      nome: form.nome.trim(),
      avisar_dias: Number(form.avisar_dias) || 30,
    };
    salvar((l) => (editando ? l.map((d) => (d.id === editando ? doc : d)) : [...l, doc]));
    toast.success(editando ? "Documento atualizado" : "Documento cadastrado");
    setEditando(null);
    setForm(novo(form.orgao));
  }

  function editar(d: Documento) {
    setEditando(d.id);
    setForm({ ...d, avisar_dias: String(d.avisar_dias) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const set =
    (k: keyof ReturnType<typeof novo>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const porOrgao = ORGAOS.filter((o) => orgaoFiltro === "Todos" || o === orgaoFiltro)
    .map((o) => ({
      orgao: o,
      docs: docs
        .filter((d) => d.orgao === o)
        .sort((a, b) => (a.validade || "9").localeCompare(b.validade || "9")),
    }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-8">
      <Painel titulo={editando ? "Editar documento" : "Cadastrar documento"}>
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Órgão">
            <Seletor opcoes={ORGAOS} value={form.orgao} onChange={set("orgao")} />
          </Campo>
          <Campo label="Documento / licença" className="lg:col-span-2">
            <Input
              list="docs-sugeridos"
              value={form.nome}
              onChange={set("nome")}
              placeholder="Escolha uma sugestão ou digite"
              required
            />
            <datalist id="docs-sugeridos">
              {(DOCUMENTOS_SUGERIDOS[form.orgao] ?? []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Número / protocolo">
            <Input value={form.numero} onChange={set("numero")} />
          </Campo>
          <Campo label="Emissão">
            <Input type="date" value={form.emissao} onChange={set("emissao")} />
          </Campo>
          <Campo label="Validade">
            <Input type="date" value={form.validade} onChange={set("validade")} />
          </Campo>
          <Campo label="Avisar com quantos dias">
            <Input type="number" min={0} value={form.avisar_dias} onChange={set("avisar_dias")} />
          </Campo>
          <Campo label="Observação">
            <Input value={form.obs} onChange={set("obs")} />
          </Campo>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" className="rounded-full">
              {editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
            {editando && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditando(null);
                  setForm(novo());
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Painel>

      <Painel
        titulo="Documentação"
        acao={
          <Seletor
            opcoes={["Todos", ...ORGAOS]}
            value={orgaoFiltro}
            onChange={(e) => setOrgaoFiltro(e.target.value)}
            className="w-56"
          />
        }
      >
        {porOrgao.length === 0 ? (
          <Vazio>Nenhum documento cadastrado.</Vazio>
        ) : (
          <div className="space-y-6">
            {porOrgao.map((g) => (
              <div key={g.orgao}>
                <p className="eyebrow mb-1 text-muted-foreground">{g.orgao}</p>
                <div className="divide-y">
                  {g.docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-semibold">{d.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {d.numero && `Nº ${d.numero} · `}Emissão {formatData(d.emissao)} ·
                          Validade {formatData(d.validade)}
                          {d.obs && ` · ${d.obs}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SituacaoBadge
                          situacao={situacao(d.validade || null, d.avisar_dias)}
                          vencimento={d.validade || null}
                        />
                        <Button variant="ghost" size="sm" onClick={() => editar(d)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            confirm("Excluir este documento?") &&
                            salvar((l) => l.filter((x) => x.id !== d.id))
                          }
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Painel>
    </div>
  );
}
