// Roda uma prova SQL de supabase/testes no banco e mostra o resultado. As provas terminam com
// `raise exception 'RESULTADO ok=… falhas=…'`, que desfaz tudo o que criaram. Uso:
//   node scripts/rodar-prova.mjs supabase/testes/rh_acessos.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: node scripts/rodar-prova.mjs supabase/testes/<prova>.sql");
  process.exit(1);
}
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
  await cliente.query(readFileSync(arquivo, "utf8"));
  console.log("A prova terminou sem o RESULTADO esperado.");
} catch (e) {
  console.log(e.message.startsWith("RESULTADO") ? e.message : `Erro na prova: ${e.message}`);
} finally {
  await cliente.end();
}
