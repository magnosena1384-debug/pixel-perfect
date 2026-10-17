// Junta as migrações em supabase/instalar-banco.sql, para rodar de uma vez no SQL Editor
// de um projeto Supabase novo. Rode com: npm run db:gerar-instalacao
import { readFileSync, writeFileSync } from "node:fs";

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const partes = journal.entries.map(
  (e) =>
    `-- ===== ${e.tag} =====\n${readFileSync(`drizzle/migrations/${e.tag}.sql`, "utf8").trim()}\n`,
);
writeFileSync(
  "supabase/instalar-banco.sql",
  `-- Gerado por scripts/gerar-instalacao-banco.mjs a partir de drizzle/migrations. Não edite à mão.\n` +
    `-- Rode uma única vez, num projeto Supabase novo, no SQL Editor.\n\n` +
    partes.join("\n"),
);
console.log(`supabase/instalar-banco.sql gerado com ${partes.length} migrações.`);
