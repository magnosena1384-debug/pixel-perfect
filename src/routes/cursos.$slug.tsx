import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDuration, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cursos/$slug")({
  head: () => ({
    meta: [
      { title: "Curso — Postos Lemon" },
      { name: "description", content: "Detalhes do curso e currículo completo." },
      { property: "og:title", content: "Curso — Postos Lemon" },
      { property: "og:description", content: "Detalhes do curso e currículo completo." },
    ],
  }),
  component: CoursePage,
});

export function useCourse(slugOrId: { slug?: string; id?: string }) {
  return useQuery({
    queryKey: ["course", slugOrId],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select("*, modules(id, titulo, ordem, lessons(id, titulo, ordem, duracao_seg, is_preview))");
      q = slugOrId.slug ? q.eq("slug", slugOrId.slug) : q.eq("id", slugOrId.id!);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      data.modules.sort((a, b) => a.ordem - b.ordem);
      data.modules.forEach((m) => m.lessons.sort((a, b) => a.ordem - b.ordem));
      return data;
    },
  });
}

function CoursePage() {
  const { slug } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const { data: course, isLoading } = useCourse({ slug });
  const { data: enrolled } = useQuery({
    queryKey: ["enrolled", course?.id, user?.id],
    enabled: !!course && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_active_enrollment", { _user_id: user!.id, _course_id: course!.id });
      return !!data;
    },
  });

  if (isLoading) return <div><SiteHeader /><p className="p-8 text-muted-foreground">Carregando…</p></div>;
  if (!course) return <div><SiteHeader /><p className="p-8">Curso não encontrado.</p></div>;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const total = lessons.reduce((s, l) => s + l.duracao_seg, 0);
  const hasAccess = enrolled || isAdmin;
  const first = lessons[0];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_340px]">
          <div>
            <p className="eyebrow text-lime">Curso</p>
            <h1 className="mt-3 text-4xl font-bold md:text-6xl">{course.titulo}</h1>
            <p className="mt-4 max-w-xl text-lg opacity-80">{course.descricao_curta}</p>
            <p className="mt-6 text-sm opacity-70">{lessons.length} aulas · {formatDuration(total)}</p>
          </div>
          <div className="rounded-3xl bg-card p-6 text-card-foreground">
            <p className="text-3xl font-bold">{course.preco_centavos ? formatBRL(course.preco_centavos) : "Gratuito"}</p>
            {hasAccess && first ? (
              <Button asChild size="lg" className="mt-4 w-full rounded-full font-semibold">
                <Link to="/aula/$lessonId" params={{ lessonId: first.id }}>Acessar curso</Link>
              </Button>
            ) : (
              <>
                <Button size="lg" className="mt-4 w-full rounded-full font-semibold" disabled>Compra em breve</Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  {user ? "Peça ao administrador para liberar seu acesso." : "Entre na sua conta para acessar."}
                </p>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12">
        {course.descricao && <p className="mb-10 max-w-3xl whitespace-pre-line text-muted-foreground">{course.descricao}</p>}
        <h2 className="mb-6 text-2xl font-bold uppercase">Currículo</h2>
        <div className="space-y-4">
          {course.modules.map((m, i) => (
            <div key={m.id} className="overflow-hidden rounded-3xl border bg-card">
              <div className="flex items-center gap-3 bg-muted px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-bold">{i + 1}</span>
                <h3 className="font-semibold">{m.titulo}</h3>
              </div>
              <ul>
                {m.lessons.map((l) => {
                  const open = hasAccess || l.is_preview;
                  return (
                    <li key={l.id} className="flex items-center justify-between border-t px-5 py-3 text-sm">
                      <span className="flex items-center gap-3">
                        {open ? <PlayCircle className="h-4 w-4 text-forest" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                        {open && user ? (
                          <Link to="/aula/$lessonId" params={{ lessonId: l.id }} className="hover:underline">{l.titulo}</Link>
                        ) : (
                          l.titulo
                        )}
                        {l.is_preview && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">Prévia grátis</span>}
                      </span>
                      <span className="text-muted-foreground">{formatDuration(l.duracao_seg)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
