import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/meus-cursos")({
  head: () => ({ meta: [{ title: "Meus cursos — Postos Lemon" }] }),
  component: MyCourses,
});

function MyCourses() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["my-courses", user.id],
    queryFn: async () => {
      const cols = "id, slug, titulo, descricao_curta, capa_url, modules(ordem, lessons(id, ordem))";
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      let courses;
      if (isAdmin) {
        const { data, error } = await supabase.from("courses").select(cols).eq("status", "publicado").order("created_at");
        if (error) throw error;
        courses = data ?? [];
      } else {
        const { data: enr, error } = await supabase
          .from("enrollments")
          .select(`course_id, courses(${cols})`)
          .eq("user_id", user.id)
          .eq("status", "ativa");
        if (error) throw error;
        courses = (enr ?? []).flatMap((e) => (e.courses ? [e.courses] : []));
      }
      const { data: prog } = await supabase.from("lesson_progress").select("lesson_id, concluida, atualizado_em").eq("user_id", user.id);
      return courses.map((c) => {
        const lessons = [...c.modules].sort((a, b) => a.ordem - b.ordem).flatMap((m) => [...m.lessons].sort((a, b) => a.ordem - b.ordem));
        const ids = new Set(lessons.map((l) => l.id));
        const mine = (prog ?? []).filter((p) => ids.has(p.lesson_id));
        const done = mine.filter((p) => p.concluida).length;
        const last = [...mine].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0];
        const next = last?.lesson_id ?? lessons.find((l) => !mine.some((p) => p.lesson_id === l.id && p.concluida))?.id ?? lessons[0]?.id;
        return { ...c, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0, next };
      });
    },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="eyebrow text-forest">Área do aluno</p>
        <h1 className="mt-2 text-4xl font-bold uppercase">Meus cursos</h1>
        {isLoading ? (
          <p className="mt-8 text-muted-foreground">Carregando…</p>
        ) : !data?.length ? (
          <div className="mt-8 rounded-3xl bg-muted p-8">
            <p>Você ainda não tem cursos liberados.</p>
            <Button asChild className="mt-4 rounded-full"><Link to="/">Ver catálogo</Link></Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <div key={c.id} className="flex flex-col overflow-hidden rounded-3xl border bg-card">
                <div className="aspect-video">
                  {c.capa_url ? <img src={c.capa_url} alt={c.titulo} className="h-full w-full object-cover" /> : <div className="dot-grid h-full" />}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl font-semibold">{c.titulo}</h3>
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <Progress value={c.pct} className="h-2" />
                    <span className="font-semibold">{c.pct}%</span>
                  </div>
                  {c.next && (
                    <Button asChild className="mt-5 rounded-full font-semibold">
                      <Link to="/aula/$lessonId" params={{ lessonId: c.next }}>Continuar de onde parei</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
