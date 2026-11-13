// Coloca na fila da importação (tabela regulacao_importacao, migração 0023) os documentos copiados
// do Posto Seguro (.postoseguro/documentos.json). Não envia arquivo nenhum: a função do Supabase
// "importar-regulacao" baixa os PDFs depois. Pode rodar mais de uma vez: o que não mudou fica
// como está, e o que mudou volta para a fila. Uso: node scripts/postoseguro-importar.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { montarDocumento, UNIDADE_DO_POSTO } from "../src/lib/regulacao-importacao.ts";

const itens = JSON.parse(readFileSync(".postoseguro/documentos.json", "utf8"));

let urls = process.env.DATABASE_URL ? [process.env.DATABASE_URL] : [];
if (!urls.length) {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const senha = await rl.question("Digite a senha do banco do Supabase e aperte Enter: ");
  rl.close();
  urls = ["aws-1", "aws-0"].map(
    (h) =>
      `postgresql://postgres.ybftywiceifdvgnsmows:${encodeURIComponent(senha.trim())}@${h}-sa-east-1.pooler.supabase.com:5432/postgres`,
  );
}
let cliente;
for (const url of urls) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    cliente = c;
    break;
  } catch (e) {
    if (/password authentication failed/i.test(e.message)) {
      console.error("Senha errada. Confira a senha do banco e rode de novo.");
      process.exit(1);
    }
  }
}
if (!cliente) {
  console.error("Não consegui conectar ao banco. Confira a senha e a internet e rode de novo.");
  process.exit(1);
}

try {
  const { rows: unidades } = await cliente.query("select id, nome from public.unidades");
  const porNome = new Map(unidades.map((u) => [u.nome, u.id]));
  const semUnidade = new Set();
  let novos = 0;
  const contagem = {};
  await cliente.query("begin");
  for (const x of itens) {
    const nome = UNIDADE_DO_POSTO[x.posto_id];
    const unidade = nome ? porNome.get(nome) : undefined;
    if (!unidade) {
      semUnidade.add(nome ?? x.posto_id);
      continue;
    }
    const doc = montarDocumento(x);
    const r = await cliente.query(
      `insert into public.regulacao_importacao (id, unidade_id, doc, arquivo_url, arquivo_nome)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update
         set doc = excluded.doc, arquivo_url = excluded.arquivo_url,
             arquivo_nome = excluded.arquivo_nome, unidade_id = excluded.unidade_id,
             estado = 'pendente', erro = null, atualizado_em = now()
         where regulacao_importacao.doc is distinct from excluded.doc
            or regulacao_importacao.unidade_id is distinct from excluded.unidade_id`,
      [x.id, unidade, JSON.stringify(doc), x.arquivo_url || null, x.arquivo_nome || null],
    );
    novos += r.rowCount;
    contagem[nome] = (contagem[nome] ?? 0) + 1;
  }
  if (semUnidade.size)
    throw new Error(`Sem unidade correspondente para: ${[...semUnidade].join(", ")}`);
  await cliente.query("commit");
  console.log(`Fila pronta: ${novos} documentos novos (de ${itens.length} no arquivo).`);
  for (const [nome, n] of Object.entries(contagem)) console.log(`  ${nome}: ${n}`);
} catch (e) {
  await cliente.query("rollback");
  console.error(`Falhou; nada foi gravado. Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
