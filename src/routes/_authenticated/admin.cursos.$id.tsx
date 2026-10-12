import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/cursos/$id")({
  component: CourseEditor,
});

type Lesson = {
  id: string;
  titulo: string;
  descricao: string;
  video_path: string | null;
  duracao_seg: number;
  ordem: number;
  is_preview: boolean;
  lesson_assets: { id: string; tipo: string; titulo: string; url: string; ordem: number }[];
};

function useAdminCourse(id: string) {
  return useQuery({
    queryKey: ["admin-course", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, modules(id, titulo, ordem, lessons(id, titulo, descricao, video_path, duracao_seg, ordem, is_preview, lesson_assets(id, tipo, titulo, url, ordem)))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const modules = [...data.modules]
        .sort((a, b) => a.ordem - b.ordem)
        .map((m) => ({
          ...m,
          lessons: [...m.lessons]
            .sort((a, b) => a.ordem - b.ordem)
            .map((l) => ({
              ...l,
              lesson_assets: [...l.lesson_assets].sort((a, b) => a.ordem - b.ordem),
            })) as Lesson[],
        }));
      return { ...data, modules };
    },
  });
}

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${Date.now().toString(36)}-${base || "arquivo"}${ext}`;
}

function videoDuration(file: File) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(Math.round(v.duration) || 0);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** Rewrites `ordem` as 1..n for the rows of `table` in the given order, touching only rows that moved. */
async function reorder(table: "modules" | "lessons", rows: { id: string; ordem: number }[]) {
  const changed = rows
    .map((r, i) => ({ id: r.id, ordem: i + 1, before: r.ordem }))
    .filter((r) => r.ordem !== r.before);
  const results = await Promise.all(
    changed.map((r) => supabase.from(table).update({ ordem: r.ordem }).eq("id", r.id)),
  );
  return results.find((r) => r.error)?.error ?? null;
}

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  const copy = [...list];
  copy.splice(j, 0, ...copy.splice(i, 1));
  return copy;
}

function CourseEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: course, isLoading } = useAdminCourse(id);
  const [newModule, setNewModule] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-course", id] });
    qc.invalidateQueries({ queryKey: ["admin-dash"] });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!course) return <p>Curso não encontrado.</p>;

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModule.trim()) return;
    const { error } = await supabase
      .from("modules")
      .insert({ course_id: id, titulo: newModule.trim(), ordem: course!.modules.length + 1 });
    if (error) return void toast.error(error.message);
    setNewModule("");
    refresh();
  }

  async function moveModule(i: number, dir: -1 | 1) {
    const list = move(course!.modules, i, dir);
    if (!list) return;
    const error = await reorder("modules", list);
    if (error) toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-6">
      <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
        ← Voltar ao painel
      </Link>
      <CourseDetails course={course} onSaved={refresh} />

      <div className="rounded-3xl bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold uppercase">Currículo</h2>
          <form onSubmit={addModule} className="flex gap-2">
            <Input
              placeholder="Novo módulo"
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
            />
            <Button type="submit" className="rounded-full">
              <Plus className="h-4 w-4" /> Módulo
            </Button>
          </form>
        </div>
        {course.modules.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Nenhum módulo ainda. Crie o primeiro acima.
          </p>
        )}
        <div className="mt-6 space-y-4">
          {course.modules.map((m, i) => (
            <ModuleEditor
              key={m.id}
              module={m}
              index={i}
              isFirst={i === 0}
              isLast={i === course.modules.length - 1}
              onMove={(dir) => moveModule(i, dir)}
              onChanged={refresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type CourseRow = NonNullable<ReturnType<typeof useAdminCourse>["data"]>;

function CourseDetails({ course, onSaved }: { course: CourseRow; onSaved: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    titulo: "",
    slug: "",
    descricao_curta: "",
    descricao: "",
    preco: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({
      titulo: course.titulo,
      slug: course.slug,
      descricao_curta: course.descricao_curta,
      descricao: course.descricao,
      preco: (course.preco_centavos / 100).toFixed(2).replace(".", ","),
    });
  }, [
    course.id,
    course.titulo,
    course.slug,
    course.descricao_curta,
    course.descricao,
    course.preco_centavos,
  ]);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const preco = Math.round(Number(form.preco.replace(/\./g, "").replace(",", ".")) * 100);
    if (!form.titulo.trim()) return void toast.error("Informe o título.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug))
      return void toast.error("Slug inválido: use letras minúsculas, números e hífens.");
    if (!Number.isFinite(preco) || preco < 0) return void toast.error("Preço inválido.");
    const { error } = await supabase
      .from("courses")
      .update({
        titulo: form.titulo.trim(),
        slug: form.slug,
        descricao_curta: form.descricao_curta,
        descricao: form.descricao,
        preco_centavos: preco,
      })
      .eq("id", course.id);
    if (error)
      return void toast.error(
        error.code === "23505" ? "Já existe um curso com esse slug." : error.message,
      );
    toast.success("Curso salvo");
    onSaved();
  }

  async function togglePublish(publicado: boolean) {
    const { error } = await supabase
      .from("courses")
      .update({ status: publicado ? "publicado" : "rascunho" })
      .eq("id", course.id);
    if (error) return void toast.error(error.message);
    toast.success(publicado ? "Curso publicado" : "Curso voltou para rascunho");
    onSaved();
  }

  async function uploadCover(file: File) {
    setUploading(true);
    const path = `${course.id}/${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from("capas")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      return void toast.error(error.message);
    }
    const { data } = supabase.storage.from("capas").getPublicUrl(path);
    const { error: e2 } = await supabase
      .from("courses")
      .update({ capa_url: data.publicUrl })
      .eq("id", course.id);
    setUploading(false);
    if (e2) return void toast.error(e2.message);
    toast.success("Capa atualizada");
    onSaved();
  }

  async function remove() {
    if (
      !confirm(
        `Excluir "${course.titulo}"? Módulos, aulas, matrículas e progresso deste curso serão apagados.`,
      )
    )
      return;
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) return void toast.error(error.message);
    toast.success("Curso excluído");
    onSaved();
    navigate({ to: "/admin" });
  }

  const publicado = course.status === "publicado";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={save} className="space-y-4 rounded-3xl bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold uppercase">Editar curso</h1>
          {publicado && (
            <Link
              to="/cursos/$slug"
              params={{ slug: course.slug }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
            >
              Ver página <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={form.titulo} onChange={set("titulo")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (endereço)</Label>
            <Input id="slug" value={form.slug} onChange={set("slug")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="curta">Descrição curta</Label>
          <Input
            id="curta"
            value={form.descricao_curta}
            onChange={set("descricao_curta")}
            maxLength={160}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Descrição completa</Label>
          <Textarea id="desc" rows={5} value={form.descricao} onChange={set("descricao")} />
        </div>
        <div className="max-w-48 space-y-1.5">
          <Label htmlFor="preco">Preço (R$)</Label>
          <Input id="preco" inputMode="decimal" value={form.preco} onChange={set("preco")} />
          <p className="text-xs text-muted-foreground">0,00 = gratuito</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="rounded-full">
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-full text-destructive"
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" /> Excluir curso
          </Button>
        </div>
      </form>

      <div className="space-y-6">
        <div className={`rounded-3xl p-6 ${publicado ? "bg-primary" : "bg-card"}`}>
          <p className="eyebrow opacity-70">Status</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xl font-bold">{publicado ? "Publicado" : "Rascunho"}</span>
            <Switch
              checked={publicado}
              onCheckedChange={togglePublish}
              aria-label="Publicar curso"
            />
          </div>
          <p className="mt-2 text-xs opacity-70">
            {publicado ? "Visível no catálogo." : "Só administradores veem este curso."}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-6">
          <p className="eyebrow mb-3 text-forest">Capa</p>
          <div className="aspect-video overflow-hidden rounded-2xl">
            {course.capa_url ? (
              <img
                src={course.capa_url}
                alt="Capa do curso"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="dot-grid h-full" />
            )}
          </div>
          <FilePick
            accept="image/*"
            disabled={uploading}
            label={uploading ? "Enviando…" : "Enviar imagem"}
            onFile={uploadCover}
            className="mt-3 w-full"
          />
        </div>
      </div>
    </div>
  );
}

function FilePick({
  accept,
  label,
  disabled,
  onFile,
  className = "",
}: {
  accept?: string;
  label: string;
  disabled?: boolean;
  onFile: (f: File) => void;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-full border bg-background px-3 text-sm font-medium hover:bg-muted ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}
    >
      <Upload className="h-4 w-4" /> {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

type ModuleRow = CourseRow["modules"][number];

function ModuleEditor({
  module: m,
  index,
  isFirst,
  isLast,
  onMove,
  onChanged,
}: {
  module: ModuleRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => void;
}) {
  const [titulo, setTitulo] = useState(m.titulo);
  const [newLesson, setNewLesson] = useState("");
  useEffect(() => setTitulo(m.titulo), [m.titulo]);

  async function rename() {
    if (!titulo.trim() || titulo === m.titulo) return void setTitulo(m.titulo);
    const { error } = await supabase
      .from("modules")
      .update({ titulo: titulo.trim() })
      .eq("id", m.id);
    if (error) return void toast.error(error.message);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Excluir o módulo "${m.titulo}" e suas ${m.lessons.length} aulas?`)) return;
    const { error } = await supabase.from("modules").delete().eq("id", m.id);
    if (error) return void toast.error(error.message);
    onChanged();
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!newLesson.trim()) return;
    const { error } = await supabase
      .from("lessons")
      .insert({ module_id: m.id, titulo: newLesson.trim(), ordem: m.lessons.length + 1 });
    if (error) return void toast.error(error.message);
    setNewLesson("");
    onChanged();
  }

  async function moveLesson(i: number, dir: -1 | 1) {
    const list = move(m.lessons, i, dir);
    if (!list) return;
    const error = await reorder("lessons", list);
    if (error) toast.error(error.message);
    onChanged();
  }

  return (
    <div className="overflow-hidden rounded-3xl border">
      <div className="flex items-center gap-3 bg-muted px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold">
          {index + 1}
        </span>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-8 border-transparent bg-transparent font-semibold shadow-none focus-visible:bg-background"
        />
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label="Subir módulo"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label="Descer módulo"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={remove}
            aria-label="Excluir módulo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ul>
        {m.lessons.map((l, i) => (
          <LessonEditor
            key={l.id}
            lesson={l}
            isFirst={i === 0}
            isLast={i === m.lessons.length - 1}
            onMove={(dir) => moveLesson(i, dir)}
            onChanged={onChanged}
          />
        ))}
      </ul>
      <form onSubmit={addLesson} className="flex gap-2 border-t px-4 py-3">
        <Input
          placeholder="Nova aula"
          value={newLesson}
          onChange={(e) => setNewLesson(e.target.value)}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="outline" className="rounded-full">
          <Plus className="h-4 w-4" /> Aula
        </Button>
      </form>
    </div>
  );
}

function LessonEditor({
  lesson: l,
  isFirst,
  isLast,
  onMove,
  onChanged,
}: {
  lesson: Lesson;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: l.titulo,
    descricao: l.descricao,
    minutos: String(Math.round(l.duracao_seg / 60)),
  });
  const [progress, setProgress] = useState<string | null>(null);
  const [asset, setAsset] = useState({ titulo: "", url: "" });

  useEffect(() => {
    setForm({
      titulo: l.titulo,
      descricao: l.descricao,
      minutos: String(Math.round(l.duracao_seg / 60)),
    });
  }, [l.titulo, l.descricao, l.duracao_seg]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const min = Number(form.minutos.replace(",", "."));
    if (!form.titulo.trim()) return void toast.error("Informe o título da aula.");
    if (!Number.isFinite(min) || min < 0) return void toast.error("Duração inválida.");
    const { error } = await supabase
      .from("lessons")
      .update({
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        duracao_seg: Math.round(min * 60),
      })
      .eq("id", l.id);
    if (error) return void toast.error(error.message);
    toast.success("Aula salva");
    onChanged();
  }

  async function setPreview(is_preview: boolean) {
    const { error } = await supabase.from("lessons").update({ is_preview }).eq("id", l.id);
    if (error) return void toast.error(error.message);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Excluir a aula "${l.titulo}"?`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", l.id);
    if (error) return void toast.error(error.message);
    if (l.video_path) await supabase.storage.from("videos").remove([l.video_path]);
    onChanged();
  }

  async function uploadVideo(file: File) {
    setProgress("Enviando vídeo…");
    const duracao = await videoDuration(file);
    const path = `${l.id}/${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from("videos")
      .upload(path, file, { contentType: file.type });
    if (error) {
      setProgress(null);
      return void toast.error(error.message);
    }
    const update: { video_path: string; duracao_seg?: number } = { video_path: path };
    if (duracao) update.duracao_seg = duracao;
    const { error: e2 } = await supabase.from("lessons").update(update).eq("id", l.id);
    if (e2) {
      setProgress(null);
      return void toast.error(e2.message);
    }
    if (l.video_path && l.video_path !== path)
      await supabase.storage.from("videos").remove([l.video_path]);
    setProgress(null);
    toast.success("Vídeo enviado");
    onChanged();
  }

  async function removeVideo() {
    if (!l.video_path || !confirm("Remover o vídeo desta aula?")) return;
    const { error } = await supabase.from("lessons").update({ video_path: null }).eq("id", l.id);
    if (error) return void toast.error(error.message);
    await supabase.storage.from("videos").remove([l.video_path]);
    onChanged();
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!asset.titulo.trim() || !/^https?:\/\//.test(asset.url))
      return void toast.error("Informe um título e uma URL começando com http(s)://");
    const { error } = await supabase.from("lesson_assets").insert({
      lesson_id: l.id,
      tipo: "link",
      titulo: asset.titulo.trim(),
      url: asset.url.trim(),
      ordem: l.lesson_assets.length + 1,
    });
    if (error) return void toast.error(error.message);
    setAsset({ titulo: "", url: "" });
    onChanged();
  }

  async function uploadAsset(file: File) {
    setProgress("Enviando arquivo…");
    const path = `${l.id}/${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from("materiais")
      .upload(path, file, { contentType: file.type });
    if (error) {
      setProgress(null);
      return void toast.error(error.message);
    }
    const { error: e2 } = await supabase.from("lesson_assets").insert({
      lesson_id: l.id,
      tipo: "arquivo",
      titulo: file.name,
      url: path,
      ordem: l.lesson_assets.length + 1,
    });
    setProgress(null);
    if (e2) return void toast.error(e2.message);
    onChanged();
  }

  async function removeAsset(a: Lesson["lesson_assets"][number]) {
    const { error } = await supabase.from("lesson_assets").delete().eq("id", a.id);
    if (error) return void toast.error(error.message);
    if (a.tipo === "arquivo") await supabase.storage.from("materiais").remove([a.url]);
    onChanged();
  }

  return (
    <li className="border-t">
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="font-medium">{l.titulo}</span>
          {l.is_preview && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
              Prévia grátis
            </span>
          )}
          {!l.video_path && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              sem vídeo
            </span>
          )}
        </button>
        <span className="hidden text-muted-foreground sm:inline">
          {formatDuration(l.duracao_seg)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label="Subir aula"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label="Descer aula"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={remove}
          aria-label="Excluir aula"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="grid gap-6 bg-muted/40 px-4 py-5 md:grid-cols-2">
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="w-28 space-y-1.5">
                <Label>Duração (min)</Label>
                <Input
                  inputMode="decimal"
                  value={form.minutos}
                  onChange={(e) => setForm((f) => ({ ...f, minutos: e.target.value }))}
                />
              </div>
              <label className="flex h-9 items-center gap-2 text-sm">
                <Switch checked={l.is_preview} onCheckedChange={setPreview} /> Prévia grátis
              </label>
            </div>
            <Button type="submit" size="sm" className="rounded-full">
              Salvar aula
            </Button>
          </form>

          <div className="space-y-5">
            <div>
              <p className="eyebrow mb-2 text-forest">Vídeo</p>
              {l.video_path ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="truncate rounded-xl border bg-background px-3 py-1.5">
                    {l.video_path.split("/").pop()}
                  </span>
                  <FilePick
                    accept="video/*"
                    label="Substituir"
                    disabled={!!progress}
                    onFile={uploadVideo}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive"
                    onClick={removeVideo}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <FilePick
                  accept="video/*"
                  label="Enviar vídeo"
                  disabled={!!progress}
                  onFile={uploadVideo}
                />
              )}
              {progress && <p className="mt-2 text-xs text-muted-foreground">{progress}</p>}
            </div>

            <div>
              <p className="eyebrow mb-2 text-forest">Materiais</p>
              <ul className="space-y-1.5">
                {l.lesson_assets.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-sm"
                  >
                    {a.tipo === "arquivo" ? (
                      <FileText className="h-4 w-4 shrink-0" />
                    ) : (
                      <Link2 className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{a.titulo}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeAsset(a)}
                      aria-label="Remover material"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <FilePick
                label="Enviar arquivo"
                disabled={!!progress}
                onFile={uploadAsset}
                className="mt-2"
              />
              <form onSubmit={addLink} className="mt-3 flex flex-wrap gap-2">
                <Input
                  placeholder="Título do link"
                  value={asset.titulo}
                  onChange={(e) => setAsset((s) => ({ ...s, titulo: e.target.value }))}
                  className="h-8 min-w-32 flex-1"
                />
                <Input
                  placeholder="https://…"
                  value={asset.url}
                  onChange={(e) => setAsset((s) => ({ ...s, url: e.target.value }))}
                  className="h-8 min-w-40 flex-1"
                />
                <Button type="submit" size="sm" variant="outline" className="rounded-full">
                  <Plus className="h-4 w-4" /> Link
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
