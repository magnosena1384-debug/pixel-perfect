import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PERMISSOES, type Permissao, type Unidade } from "@/lib/gestao";

export const Route = createFileRoute("/_authenticated/admin/acessos")({
  component: Acessos,
});

const TODOS = PERMISSOES.map((m) => m.id as Permissao);

function useDados() {
  return useQuery({
    queryKey: ["admin-acessos"],
    queryFn: async () => {
      const [p, r, u, a] = await Promise.all([
        supabase.from("profiles").select("id, nome, email").order("nome"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
        supabase.from("unidades").select("id, nome, ordem").order("ordem"),
        supabase.from("gestao_acessos").select("user_id, unidade_id, modulos"),
      ]);
      const erro = p.error ?? r.error ?? u.error ?? a.error;
      if (erro) throw erro;
      return {
        usuarios: p.data ?? [],
        admins: new Set((r.data ?? []).map((x) => x.user_id)),
        unidades: u.data ?? [],
        acessos: a.data ?? [],
      };
    },
  });
}

function Acessos() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useDados();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;

  const lista = data.usuarios.filter((p) =>
    `${p.nome} ${p.email}`.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold uppercase">Acessos por usuário</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cursos ficam liberados por matrícula (aba Alunos). Aqui você define quem é
              administrador e o que cada pessoa acessa na Gestão do posto, por unidade.
            </p>
          </div>
          <Input
            placeholder="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="mt-4 divide-y">
          {lista.map((p) => {
            const admin = data.admins.has(p.id);
            const meus = data.acessos.filter((a) => a.user_id === p.id && a.modulos.length);
            const resumo = admin
              ? "Administrador · acesso total"
              : meus.length
                ? `Gestão em ${meus.length} unidade${meus.length > 1 ? "s" : ""}`
                : "Sem acesso à gestão";
            return (
              <div key={p.id} className="py-4">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => setAberto(aberto === p.id ? null : p.id)}
                  aria-expanded={aberto === p.id}
                >
                  {aberto === p.id ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="font-semibold">{p.nome || "Sem nome"}</span>
                  <span className="text-muted-foreground">· {p.email}</span>
                  <span
                    className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${admin ? "bg-primary" : meus.length ? "bg-accent" : "bg-muted text-muted-foreground"}`}
                  >
                    {resumo}
                  </span>
                </button>
                {aberto === p.id && (
                  <AcessoUsuario
                    userId={p.id}
                    eu={p.id === user.id}
                    admin={admin}
                    unidades={data.unidades}
                    acessos={data.acessos.filter((a) => a.user_id === p.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Unidades unidades={data.unidades} />
    </div>
  );
}

function AcessoUsuario({
  userId,
  eu,
  admin,
  unidades,
  acessos,
}: {
  userId: string;
  eu: boolean;
  admin: boolean;
  unidades: Unidade[];
  acessos: { unidade_id: string; modulos: string[] }[];
}) {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["admin-acessos"] });
  const modulosDe = (unidade: string) =>
    new Set(acessos.find((a) => a.unidade_id === unidade)?.modulos ?? []);

  async function definir(unidade: string, modulos: string[]) {
    const { error } = modulos.length
      ? await supabase
          .from("gestao_acessos")
          .upsert({ user_id: userId, unidade_id: unidade, modulos })
      : await supabase
          .from("gestao_acessos")
          .delete()
          .eq("user_id", userId)
          .eq("unidade_id", unidade);
    if (error) toast.error(error.message);
    await recarregar();
  }

  async function todas(modulos: string[]) {
    await Promise.all(unidades.map((u) => definir(u.id, modulos)));
    toast.success(modulos.length ? "Acesso total à gestão liberado" : "Acessos à gestão removidos");
  }

  async function alternarAdmin(valor: boolean) {
    if (eu && !valor)
      return void toast.error("Você não pode remover seu próprio acesso de administrador.");
    const { error } = valor
      ? await supabase.from("user_roles").insert({ user_id: userId, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) return void toast.error(error.message);
    toast.success(valor ? "Agora é administrador" : "Deixou de ser administrador");
    await recarregar();
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-muted/50 p-4">
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={admin} onCheckedChange={alternarAdmin} disabled={eu && admin} />
        <span>
          <span className="font-semibold">Administrador</span> — acesso total: cursos, alunos,
          acessos e todas as unidades.
        </span>
      </label>

      {!admin && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => todas(TODOS)}
            >
              Liberar tudo em todas as unidades
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => todas([])}>
              Remover acesso à gestão
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Unidade</th>
                  {PERMISSOES.map((m) => (
                    <th key={m.id} className="px-2 py-2 text-center font-medium">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium">Todos</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => {
                  const atuais = modulosDe(u.id);
                  const tudo = TODOS.every((m) => atuais.has(m));
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{u.nome}</td>
                      {PERMISSOES.map((m) => (
                        <td key={m.id} className="px-2 py-2 text-center">
                          <Checkbox
                            aria-label={`${m.label} em ${u.nome}`}
                            checked={atuais.has(m.id)}
                            onCheckedChange={(v) => {
                              const novo = new Set(atuais);
                              if (v) novo.add(m.id);
                              else novo.delete(m.id);
                              void definir(
                                u.id,
                                TODOS.filter((x) => novo.has(x)),
                              );
                            }}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <Checkbox
                          aria-label={`Todos os módulos em ${u.nome}`}
                          checked={tudo}
                          onCheckedChange={(v) => void definir(u.id, v ? TODOS : [])}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Unidades({ unidades }: { unidades: Unidade[] }) {
  return (
    <div className="rounded-3xl bg-card p-6">
      <h2 className="text-2xl font-bold uppercase">Unidades</h2>
      <p className="mt-1 text-sm text-muted-foreground">Clique no nome para corrigir.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {unidades.map((u) => (
          <NomeUnidade key={u.id} unidade={u} />
        ))}
      </ul>
    </div>
  );
}

function NomeUnidade({ unidade }: { unidade: Unidade }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(unidade.nome);
  useEffect(() => setNome(unidade.nome), [unidade.nome]);

  async function salvar() {
    const novo = nome.trim();
    if (!novo || novo === unidade.nome) return setNome(unidade.nome);
    const { error } = await supabase.from("unidades").update({ nome: novo }).eq("id", unidade.id);
    if (error) {
      setNome(unidade.nome);
      return void toast.error(
        error.code === "23505" ? "Já existe uma unidade com esse nome." : error.message,
      );
    }
    toast.success("Unidade renomeada");
    void qc.invalidateQueries({ queryKey: ["admin-acessos"] });
    void qc.invalidateQueries({ queryKey: ["gestao"] });
  }

  return (
    <li>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={`Nome da unidade ${unidade.ordem}`}
      />
    </li>
  );
}
