// Importa para a Regulação os documentos da fila regulacao_importacao (migração 0023): baixa o
// PDF do endereço público do Posto Seguro, guarda no espaço "regulacao-documentos" e cria o
// documento em gestao_itens. Cada chamada trata até 4 documentos. Só aceita quem manda o segredo
// do agendador (o mesmo da importação do webPosto, no Vault: webposto_cron_segredo).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BUCKET = "regulacao-documentos";
const POR_CHAMADA = 4;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: autorizado } = await supabase.rpc("webposto_cron_confere", {
    _segredo: req.headers.get("x-cron-segredo") ?? "",
  });
  if (!autorizado) return new Response("Não autorizado", { status: 401 });

  const { data: linhas, error } = await supabase.rpc("regulacao_importacao_pegar", {
    _n: POR_CHAMADA,
  });
  if (error) return new Response(error.message, { status: 500 });

  let feitos = 0;
  const erros: string[] = [];
  for (const l of linhas ?? []) {
    try {
      let caminho: string | undefined;
      if (l.arquivo_url) {
        const res = await fetch(l.arquivo_url);
        if (!res.ok) throw new Error(`o arquivo respondeu ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length === 0) throw new Error("o arquivo veio vazio");
        caminho = `${l.unidade_id}/${l.doc.id}.pdf`;
        const { error: e1 } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, bytes, { contentType: "application/pdf", upsert: true });
        if (e1) throw new Error(e1.message);
      }
      const dados = {
        ...l.doc,
        ...(caminho ? { arquivo: caminho, arquivo_nome: l.arquivo_nome || "documento.pdf" } : {}),
      };
      const { error: e2 } = await supabase.from("gestao_itens").upsert({
        id: l.doc.id,
        unidade_id: l.unidade_id,
        colecao: "documentos",
        dados,
        atualizado_em: new Date().toISOString(),
      });
      if (e2) throw new Error(e2.message);
      await supabase
        .from("regulacao_importacao")
        .update({ estado: "feito", erro: null, atualizado_em: new Date().toISOString() })
        .eq("id", l.id);
      feitos += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`${l.id}: ${msg}`);
      await supabase
        .from("regulacao_importacao")
        .update({ estado: "erro", erro: msg, atualizado_em: new Date().toISOString() })
        .eq("id", l.id);
    }
  }
  return Response.json({ pegos: linhas?.length ?? 0, feitos, erros });
});
