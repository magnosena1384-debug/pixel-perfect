import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { perguntarSobreAula } from "@/lib/duvidas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function LessonQuestions({ lessonId, userId }: { lessonId: string; userId: string }) {
  const qc = useQueryClient();
  const perguntar = useServerFn(perguntarSobreAula);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: historico = [] } = useQuery({
    queryKey: ["duvidas", lessonId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_questions")
        .select("id, pergunta, resposta, created_at")
        .eq("lesson_id", lessonId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (pergunta.trim().length < 3) return;
    setEnviando(true);
    try {
      await perguntar({ data: { lessonId, pergunta: pergunta.trim() } });
      setPergunta("");
      await qc.invalidateQueries({ queryKey: ["duvidas", lessonId, userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a dúvida.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={enviar} className="space-y-2">
        <Textarea
          rows={3}
          maxLength={1000}
          placeholder="Escreva sua dúvida sobre esta aula…"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          disabled={enviando}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Respostas geradas por IA com base no conteúdo da aula. Confirme procedimentos com seu
            supervisor.
          </p>
          <Button type="submit" size="sm" className="shrink-0 rounded-full" disabled={enviando}>
            <Sparkles className="h-4 w-4" /> {enviando ? "Pensando…" : "Enviar dúvida"}
          </Button>
        </div>
      </form>
      {historico.length > 0 && (
        <ul className="space-y-3">
          {historico.map((q) => (
            <li key={q.id} className="rounded-2xl border p-4 text-sm">
              <p className="font-semibold">{q.pergunta}</p>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">
                {q.resposta.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[-*] /gm, "• ")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
