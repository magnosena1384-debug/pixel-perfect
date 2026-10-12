import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDuration } from "@/lib/auth";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Postos Lemon — Cursos e treinamentos" },
      { name: "description", content: "Aulas em vídeo para equipes Lemon: atendimento, segurança e operação de pista." },
      { property: "og:title", content: "Postos Lemon — Cursos e treinamentos" },
      { property: "og:description", content: "Aulas em vídeo para equipes Lemon: atendimento, segurança e operação de pista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, slug, titulo, descricao_curta, capa_url, preco_centavos, modules(lessons(duracao_seg))")
        .eq("status", "publicado")
        .order("created_at");
      if (error) throw error;
      return data.map((c) => {
        const lessons = c.modules.flatMap((m) => m.lessons);
        return { ...c, nAulas: lessons.length, duracao: lessons.reduce((s, l) => s + l.duracao_seg, 0) };
      });
    },
  });
}

function Index() {
  const { data, isLoading } = useCatalog();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div className="dot-grid-fade absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-end gap-8 px-4 pt-12 md:grid-cols-2 md:pt-20">
          <div className="pb-12 md:pb-20">
            <p className="eyebrow text-lime">Plataforma de treinamento</p>
            <h1 className="mt-4 text-5xl font-bold leading-[0.95] md:text-7xl">
              A melhor forma de aprender.
            </h1>
            <div className="my-6 h-px w-40 bg-secondary-foreground/40" />
            <p className="max-w-md text-lg opacity-90">
              Aulas em vídeo para sua equipe dominar a operação, no seu ritmo e de onde parou.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full px-8 font-semibold">
              <a href="#cursos">Ver cursos</a>
            </Button>
          </div>
          <img src={hero} alt="Atendente sorrindo na pista" width={1024} height={1200} className="mx-auto max-h-[520px] w-auto object-contain" />
        </div>
      </section>

      <section id="cursos" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-bold uppercase md:text-4xl">Cursos</h2>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : !data?.length ? (
          <p className="text-muted-foreground">Nenhum curso publicado ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <Link key={c.id} to="/cursos/$slug" params={{ slug: c.slug }} className="group overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1 hover:shadow-lg">
                <div className="aspect-video overflow-hidden">
                  {c.capa_url ? (
                    <img src={c.capa_url} alt={c.titulo} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="dot-grid flex h-full items-center justify-center">
                      <span className="wordmark rounded-2xl bg-ink px-4 py-2 text-xl text-lime">Lemon</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold group-hover:text-forest">{c.titulo}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.descricao_curta}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.nAulas} aulas · {formatDuration(c.duracao)}</span>
                    <span className="font-semibold">{c.preco_centavos ? formatBRL(c.preco_centavos) : "Gratuito"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <footer className="bg-ink py-10 text-cream">
        <div className="mx-auto max-w-6xl px-4 text-sm opacity-80">© {new Date().getFullYear()} Postos Lemon</div>
      </footer>
    </div>
  );
}
