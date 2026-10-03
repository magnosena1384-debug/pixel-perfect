import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Dashboard() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const [courses, students, enr, prog] = await Promise.all([
        supabase.from("courses").select("id, titulo, slug, status, preco_centavos, modules(lessons(id))").order("created_at"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("course_id, user_id, inicio").eq("status", "ativa"),
        supabase.from("lesson_progress").select("lesson_id, user_id").eq("concluida", true),
      ]);
      const since = Date.now() - 30 * 864e5;
      return {
        courses: (courses.data ?? []).map((c) => {
          const ids = new Set(c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
          const enrolled = (enr.data ?? []).filter((e) => e.course_id === c.id);
          const doneTotal = (prog.data ?? []).filter((p) => ids.has(p.lesson_id) && enrolled.some((e) => e.user_id === p.user_id)).length;
          const rate = enrolled.length && ids.size ? Math.round((doneTotal / (enrolled.length * ids.size)) * 100) : 0;
          return { ...c, nAulas: ids.size, nAlunos: enrolled.length, rate };
        }),
        students: students.count ?? 0,
        active: new Set((enr.data ?? []).map((e) => e.user_id)).size,
        recent: (enr.data ?? []).filter((e) => new Date(e.inicio).getTime() > since).length,
      };
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const { data: c, error } = await supabase.from("courses").insert({ titulo, slug: `${slugify(titulo)}-${Date.now().toString(36)}` }).select("id").single();
    if (error) return toast.error(error.message);
    navigate({ to: "/admin/cursos/$id", params: { id: c.id } });
  }

  const stats = [
    { label: "Contas", value: data?.students ?? "—" },
    { label: "Alunos ativos", value: data?.active ?? "—" },
    { label: "Matrículas (30 dias)", value: data?.recent ?? "—" },
    { label: "Cursos", value: data?.courses.length ?? "—" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`rounded-3xl p-6 ${i === 0 ? "bg-primary" : i === 1 ? "bg-secondary text-secondary-foreground" : "bg-card"}`}>
            <p className="eyebrow opacity-70">{s.label}</p>
            <p className="mt-2 text-4xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold uppercase">Cursos</h2>
          <form onSubmit={create} className="flex gap-2">
            <Input placeholder="Título do novo curso" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Button type="submit" className="rounded-full">Criar</Button>
          </form>
        </div>
        <div className="mt-6 divide-y">
          {data?.courses.map((c) => (
            <Link key={c.id} to="/admin/cursos/$id" params={{ id: c.id }} className="flex flex-wrap items-center justify-between gap-2 py-4 hover:bg-muted/50">
              <div>
                <p className="font-semibold">{c.titulo}</p>
                <p className="text-sm text-muted-foreground">{c.nAulas} aulas · {c.nAlunos} alunos · conclusão {c.rate}%</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>{formatBRL(c.preco_centavos)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.status === "publicado" ? "bg-primary" : "bg-muted"}`}>{c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
