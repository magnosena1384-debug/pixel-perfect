import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Lovable AI Gateway (compatível com a API de chat da OpenAI). A chave é criada pelo
// Lovable Cloud quando o Lovable AI está ativo no projeto.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELO_PADRAO = "google/gemini-3-flash-preview";
const LIMITE_DIARIO = 20;

const SISTEMA = `Você é o tutor da plataforma de treinamento dos Postos Lemon (postos de combustível).
Responda à dúvida do aluno em português do Brasil, de forma clara, curta e prática.
Use apenas o conteúdo da aula fornecido abaixo. Se a resposta não estiver no conteúdo, diga isso
com franqueza e oriente o aluno a confirmar com o gerente ou supervisor do posto.
Em assuntos de segurança (incêndio, vazamento, abastecimento, eletricidade), nunca invente
procedimentos: repita só o que a aula diz e reforce que, em emergência, o aluno deve seguir o
plano de emergência do posto e acionar os bombeiros (193).`;

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

    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) throw new Error("IA não configurada: ative o Lovable AI no projeto.");

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env["LOVABLE_AI_MODEL"] || MODELO_PADRAO,
        messages: [
          { role: "system", content: `${SISTEMA}\n\n--- CONTEÚDO DA AULA ---\n${contexto}` },
          { role: "user", content: data.pergunta },
        ],
      }),
    });
    if (res.status === 429)
      throw new Error("Muitas dúvidas ao mesmo tempo. Tente de novo em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Avise o administrador.");
    if (!res.ok) {
      console.error("[duvidas] gateway", res.status, await res.text().catch(() => ""));
      throw new Error("Não foi possível gerar a resposta agora.");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const resposta = json.choices?.[0]?.message?.content?.trim();
    if (!resposta) throw new Error("A IA não retornou resposta. Tente reformular a dúvida.");

    const { data: salva, error } = await supabase
      .from("lesson_questions")
      .insert({ user_id: userId, lesson_id: data.lessonId, pergunta: data.pergunta, resposta })
      .select("id, pergunta, resposta, created_at")
      .single();
    if (error) throw new Error(error.message);
    return salva;
  });
