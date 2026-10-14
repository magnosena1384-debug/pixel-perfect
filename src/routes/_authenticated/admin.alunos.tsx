import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/alunos")({
  component: Students,
});

function Students() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [courseId, setCourseId] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [p, c, e] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, email, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("courses").select("id, titulo").order("titulo"),
        supabase.from("enrollments").select("id, user_id, course_id, status"),
      ]);
      return { profiles: p.data ?? [], courses: c.data ?? [], enrollments: e.data ?? [] };
    },
  });

  async function grant(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const target = data?.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!target)
      return void toast.error(
        "Nenhuma conta com esse e-mail. O aluno precisa se cadastrar primeiro.",
      );
    if (!courseId) return void toast.error("Escolha um curso.");
    const { error } = await supabase
      .from("enrollments")
      .upsert(
        { user_id: target.id, course_id: courseId, status: "ativa", origem: "manual" },
        { onConflict: "user_id,course_id" },
      );
    if (error) return void toast.error(error.message);
    toast.success("Acesso liberado");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  async function setStatus(id: string, status: "ativa" | "revogada"): Promise<void> {
    const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  const list = (data?.profiles ?? []).filter((p) =>
    `${p.nome} ${p.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const courseName = (id: string) => data?.courses.find((c) => c.id === id)?.titulo ?? "—";

  return (
    <div className="space-y-6">
      <form onSubmit={grant} className="flex flex-wrap items-end gap-3 rounded-3xl bg-card p-6">
        <div className="min-w-60 flex-1">
          <p className="eyebrow mb-2 text-forest">Conceder acesso manual</p>
          <Input
            type="email"
            placeholder="email@aluno.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Curso…</option>
          {data?.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
        <Button type="submit" className="rounded-full">
          Liberar
        </Button>
      </form>

      <div className="rounded-3xl bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold uppercase">Alunos</h2>
          <Input
            placeholder="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="mt-4 divide-y">
          {list.map((p) => {
            const enr = data!.enrollments.filter((e) => e.user_id === p.id);
            return (
              <div key={p.id} className="py-4">
                <p className="font-semibold">
                  {p.nome || "Sem nome"}{" "}
                  <span className="font-normal text-muted-foreground">· {p.email}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {enr.length === 0 && (
                    <span className="text-sm text-muted-foreground">Sem matrículas</span>
                  )}
                  {enr.map((e) => (
                    <span
                      key={e.id}
                      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${e.status === "ativa" ? "bg-accent" : "bg-muted line-through"}`}
                    >
                      {courseName(e.course_id)}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => setStatus(e.id, e.status === "ativa" ? "revogada" : "ativa")}
                      >
                        {e.status === "ativa" ? "revogar" : "reativar"}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
