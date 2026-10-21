// Aplica migrações do drizzle/migrations num banco Postgres (Supabase), numa transação só:
// se uma falhar, nenhuma fica. Uso:
//   DATABASE_URL="postgresql://..." node scripts/aplicar-migracoes.mjs 0008 0016
// A DATABASE_URL vem do painel do Supabase (Connect → Session pooler). Não vai para o Git.
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const [de, ate] = process.argv.slice(2);
if (!de || !ate) {
  console.error("Uso: node scripts/aplicar-migracoes.mjs 0008 0016");
  process.exit(1);
}
let urls = process.env.DATABASE_URL ? [process.env.DATABASE_URL] : [];
if (!urls.length) {
  // Sem DATABASE_URL: pergunta só a senha e tenta os servidores do Supabase em São Paulo.
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const senha = await rl.question("Digite a senha do banco do Supabase e aperte Enter: ");
  rl.close();
  urls = ["aws-1", "aws-0"].map(
    (h) =>
      `postgresql://postgres.ybftywiceifdvgnsmows:${encodeURIComponent(senha.trim())}@${h}-sa-east-1.pooler.supabase.com:5432/postgres`,
  );
}
const arquivos = readdirSync("drizzle/migrations")
  .filter((f) => f.endsWith(".sql") && f.slice(0, 4) >= de && f.slice(0, 4) <= ate)
  .sort();

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
  await cliente.query("begin");
  for (const f of arquivos) {
    process.stdout.write(`Aplicando ${f}… `);
    await cliente.query(readFileSync(`drizzle/migrations/${f}`, "utf8"));
    console.log("ok");
  }
  await cliente.query("commit");
  console.log(`Pronto: ${arquivos.length} migrações aplicadas.`);
} catch (e) {
  await cliente.query("rollback");
  console.error(`\nFalhou; nada foi gravado. Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
