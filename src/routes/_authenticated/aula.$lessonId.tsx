import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, FileText, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LessonQuestions } from "@/components/LessonQuestions";

export const Route = createFileRoute("/_authenticated/aula/$lessonId")({
  head: () => ({ meta: [{ title: "Aula — Postos Lemon" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ["lesson", lessonId, user.id],
    queryFn: async () => {
      const { data: courseId } = await supabase.rpc("lesson_course_id", { _lesson_id: lessonId });
      if (!courseId) return null;
      const [{ data: course }, { data: access }, { data: prog }, { data: assets }] = await Promise.all([
        supabase.from("courses").select("id, slug, titulo, modules(id, titulo, ordem, lessons(id, titulo, descricao, ordem, video_path, is_preview, duracao_seg))").eq("id", courseId).single(),
        supabase.rpc("can_access_lesson", { _user_id: user.id, _lesson_id: lessonId }),
        supabase.from("lesson_progress").select("lesson_id, posicao_seg, concluida").eq("user_id", user.id),
        supabase.from("lesson_assets").select("*").eq("lesson_id", lessonId).order("ordem"),
      ]);
      if (!course) return null;
      const { data: enrolled } = await supabase.rpc("has_active_enrollment", { _user_id: user.id, _course_id: courseId });
      const { data: admin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const modules = [...course.modules].sort((a, b) => a.ordem - b.ordem).map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.ordem - b.ordem) }));
      const flat = modules.flatMap((m) => m.lessons);
      const lesson = flat.find((l) => l.id === lessonId)!;
      let videoUrl: string | null = null;
      if (access && lesson.video_path) {
        const { data: s } = await supabase.storage.from("videos").createSignedUrl(lesson.video_path, 60 * 60);
        videoUrl = s?.signedUrl ?? null;
      }
      const signedAssets = await Promise.all(
        (assets ?? []).map(async (a) => {
          if (a.tipo !== "arquivo") return a;
          const { data: s } = await supabase.storage.from("materiais").createSignedUrl(a.url, 60 * 10, { download: true });
          return { ...a, url: s?.signedUrl ?? "#" };
        }),
      );
      return { course, modules, flat, lesson, access: !!access, full: !!enrolled || !!admin, prog: prog ?? [], assets: signedAssets, videoUrl };
    },
  });

  async function save(pos: number, concluida?: boolean) {
    const current = data?.prog.find((p) => p.lesson_id === lessonId);
    const { error } = await supabase.from("lesson_progress").upsert(
      { user_id: user.id, lesson_id: lessonId, posicao_seg: Math.floor(pos), concluida: concluida ?? current?.concluida ?? false, atualizado_em: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" },
    );
    if (!error && concluida !== undefined) qc.invalidateQueries({ queryKey: ["lesson"] });
  }

  // resume position
  useEffect(() => {
    const v = videoRef.current;
    const p = data?.prog.find((x) => x.lesson_id === lessonId);
    if (v && p && p.posicao_seg > 0) {
      const set = () => { if (p.posicao_seg < v.duration - 5) v.currentTime = p.posicao_seg; };
      if (v.readyState >= 1) set(); else v.addEventListener("loadedmetadata", set, { once: true });
    }
  }, [data?.videoUrl, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // save on leave
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v && v.currentTime > 0) void save(v.currentTime);
    };
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div><SiteHeader /><p className="p-8 text-muted-foreground">Carregando aula…</p></div>;
  if (!data) return <div><SiteHeader /><p className="p-8">Aula não encontrada.</p></div>;

  const { course, modules, flat, lesson, access, full, prog, assets, videoUrl } = data;
  const idx = flat.findIndex((l) => l.id === lessonId);
  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  const done = prog.find((p) => p.lesson_id === lessonId)?.concluida;
  const doneCount = flat.filter((l) => prog.some((p) => p.lesson_id === l.id && p.concluida)).length;
  const pct = Math.round((doneCount / flat.length) * 100);

  const onTime = () => {
    const v = videoRef.current!;
    if (Math.abs(v.currentTime - lastSaved.current) >= 10) {
      lastSaved.current = v.currentTime;
      void save(v.currentTime);
    }
    if (!done && v.duration && v.currentTime / v.duration >= 0.9) {
      void save(v.currentTime, true);
      toast.success("Aula concluída!");
    }
  };

  const curriculum = (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm"><span>Progresso</span><span className="font-semibold">{pct}%</span></div>
        <Progress value={pct} className="mt-2 h-2" />
      </div>
      {modules.map((m) => (
        <div key={m.id}>
          <p className="eyebrow mb-2 text-muted-foreground">{m.titulo}</p>
          <ul className="space-y-1">
            {m.lessons.map((l) => {
              const isDone = prog.some((p) => p.lesson_id === l.id && p.concluida);
              const open = full || l.is_preview;
              return (
                <li key={l.id}>
                  <Link
                    to="/aula/$lessonId"
                    params={{ lessonId: l.id }}
                    disabled={!open}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${l.id === lessonId ? "bg-primary font-semibold" : "hover:bg-muted"} ${!open ? "opacity-50" : ""}`}
                  >
                    {!open ? <Lock className="h-4 w-4" /> : isDone ? <CheckCircle2 className="h-4 w-4 text-forest" /> : <Circle className="h-4 w-4" />}
                    {l.titulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  const materials = assets.length ? (
    <ul className="space-y-2">
      {assets.map((a) => (
        <li key={a.id}>
          <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm hover:bg-muted">
            {a.tipo === "arquivo" ? <FileText className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {a.titulo}
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">Sem materiais para esta aula.</p>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Link to="/cursos/$slug" params={{ slug: course.slug }} className="text-sm text-muted-foreground hover:underline">← {course.titulo}</Link>
          <div className="mt-3 aspect-video overflow-hidden rounded-3xl bg-ink">
            {!access ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-cream"><Lock /> Você não tem acesso a esta aula.</div>
            ) : videoUrl ? (
              <video
                ref={videoRef}
                key={videoUrl}
                src={videoUrl}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onTimeUpdate={onTime}
                onPause={() => videoRef.current && save(videoRef.current.currentTime)}
                className="h-full w-full"
              />
            ) : (
              <div className="dot-grid flex h-full items-center justify-center"><span className="rounded-2xl bg-ink px-4 py-2 text-cream">Vídeo em breve</span></div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-2xl font-bold md:text-3xl">{lesson.titulo}</h1>
            {access && (
              <Button variant={done ? "secondary" : "default"} className="rounded-full font-semibold" onClick={() => save(videoRef.current?.currentTime ?? 0, !done)}>
                {done ? "Concluída ✓" : "Marcar como concluída"}
              </Button>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {prev && <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/aula/$lessonId" params={{ lessonId: prev.id }}><ChevronLeft className="h-4 w-4" /> Anterior</Link></Button>}
            {next && <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/aula/$lessonId" params={{ lessonId: next.id }}>Próxima <ChevronRight className="h-4 w-4" /></Link></Button>}
          </div>
          <div className="mt-6 hidden lg:block">
            {lesson.descricao && <p className="whitespace-pre-line text-muted-foreground">{lesson.descricao}</p>}
            <h2 className="mb-3 mt-8 text-lg font-bold uppercase">Materiais</h2>
            {materials}
            {access && (
              <>
                <h2 className="mb-3 mt-8 text-lg font-bold uppercase">Dúvidas</h2>
                <LessonQuestions lessonId={lessonId} userId={user.id} />
              </>
            )}
          </div>
          <Tabs defaultValue="aula" className="mt-6 lg:hidden">
            <TabsList className="w-full">
              <TabsTrigger value="aula" className="flex-1">Aula</TabsTrigger>
              <TabsTrigger value="mat" className="flex-1">Materiais</TabsTrigger>
              <TabsTrigger value="cur" className="flex-1">Currículo</TabsTrigger>
              {access && <TabsTrigger value="duv" className="flex-1">Dúvidas</TabsTrigger>}
            </TabsList>
            <TabsContent value="aula"><p className="whitespace-pre-line pt-3 text-muted-foreground">{lesson.descricao || "Sem descrição."}</p></TabsContent>
            <TabsContent value="mat" className="pt-3">{materials}</TabsContent>
            <TabsContent value="cur" className="pt-3">{curriculum}</TabsContent>
            {access && <TabsContent value="duv" className="pt-3"><LessonQuestions lessonId={lessonId} userId={user.id} /></TabsContent>}
          </Tabs>
        </div>
        <aside className="hidden rounded-3xl border bg-card p-5 lg:block">{curriculum}</aside>
      </div>
    </div>
  );
}
