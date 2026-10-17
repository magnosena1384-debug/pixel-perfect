import Anthropic from "@anthropic-ai/sdk";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Respostas geradas pelo Claude (API da Anthropic). A chave fica no segredo ANTHROPIC_API_KEY.
const MODELO = "claude-opus-5-5";
const LIMITE_DIARIO = 20;

const SISTEMA = `Você é o tutor da plataforma de treinamento dos Postos Lemon (postos de combustível).
Responda à dúvida do aluno em português do Brasil, de forma clara, curta e prática.
Use apenas o conteúdo da aula fornecido abaixo. Se a resposta não estiver no conteúdo, diga isso
com franqueza e oriente o aluno a confirmar com o gerente ou supervisor do posto.
Em assuntos de segurança (incêndio, vazamento, abastecimento, eletricidade), nunca invente
procedimentos: repita só o que a aula diz e reforce que, em emergência, o aluno deve seguir o
plano de emergência do posto e acionar os bombeiros (193).
Escreva em texto simples, sem Markdown (sem asteriscos, títulos ou tabelas); use "- " para listas.`;

export const perguntarSobreAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lessonId: z.string().uuid(),
      pergunta: z
        .string()
        .trim()
        .min(3, "Escreva sua dúvida.")
        .max(1000, "Máximo de 1000 caracteres."),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: acesso } = await supabase.rpc("can_access_lesson", {
      _user_id: userId,
      _lesson_id: data.lessonId,
    });
    if (!acesso) throw new Error("Você não tem acesso a esta aula.");

    const desde = new Date(Date.now() - 864e5).toISOString();
    const { count } = await supabase
      .from("lesson_questions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", desde);
    if ((count ?? 0) >= LIMITE_DIARIO)
      throw new Error(`Limite de ${LIMITE_DIARIO} dúvidas por dia atingido. Tente amanhã.`);

    const [{ data: aula }, { data: transcricao }, { data: materiais }] = await Promise.all([
      supabase
        .from("lessons")
        .select("titulo, descricao, modules(titulo, courses(titulo))")
        .eq("id", data.lessonId)
        .single(),
      supabase
        .from("lesson_transcripts")
        .select("texto")
        .eq("lesson_id", data.lessonId)
        .maybeSingle(),
      supabase.from("lesson_assets").select("titulo").eq("lesson_id", data.lessonId).order("ordem"),
    ]);
    if (!aula) throw new Error("Aula não encontrada.");

    const contexto = [
      `Curso: ${aula.modules?.courses?.titulo ?? "—"}`,
      `Módulo: ${aula.modules?.titulo ?? "—"}`,
      `Aula: ${aula.titulo}`,
      `Descrição da aula:\n${aula.descricao || "(sem descrição)"}`,
      `Conteúdo da aula:\n${transcricao?.texto || "(não cadastrado)"}`,
      materiais?.length ? `Materiais de apoio: ${materiais.map((m) => m.titulo).join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!process.env["ANTHROPIC_API_KEY"])
      throw new Error("IA não configurada: cadastre o segredo ANTHROPIC_API_KEY.");
    const client = new Anthropic();

    let resposta: string | undefined;
    try {
      const msg = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 4000,
        output_config: { effort: "medium" },
        // Se o modelo recusar por política, a própria API tenta o modelo reserva padrão.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // O conteúdo da aula vem antes da pergunta para ser reaproveitado em cache.
        system: [
          {
            type: "text",
            text: `${SISTEMA}\n\n--- CONTEÚDO DA AULA ---\n${contexto}`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: data.pergunta }],
      });
      if (msg.stop_reason === "refusal")
        throw new Error("A IA não pôde responder essa dúvida. Fale com seu supervisor.");
      resposta = msg.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("\n")
        .trim();
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError)
        throw new Error("Muitas dúvidas ao mesmo tempo. Tente de novo em instantes.");
      if (e instanceof Anthropic.AuthenticationError)
        throw new Error("Chave da IA inválida. Avise o administrador.");
      if (e instanceof Anthropic.APIError) {
        console.error("[duvidas] Anthropic", e.status, e.message);
        throw new Error("Não foi possível gerar a resposta agora.");
      }
      throw e;
    }
    if (!resposta) throw new Error("A IA não retornou resposta. Tente reformular a dúvida.");

    const { data: salva, error } = await supabase
      .from("lesson_questions")
      .insert({ user_id: userId, lesson_id: data.lessonId, pergunta: data.pergunta, resposta })
      .select("id, pergunta, resposta, created_at")
      .single();
    if (error) throw new Error(error.message);
    return salva;
  });
