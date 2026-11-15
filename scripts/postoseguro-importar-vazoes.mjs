// Completa as aferições já importadas com a hora e o resultado da vazão alta e baixa
// (.postoseguro/vazoes.json), nas colunas realizada_em, vazao_alta_ml e vazao_baixa_ml
// (migração 0025). Só atualiza aferições que já existem (pelo id de origem); não cria nenhuma.
// Uso: node scripts/postoseguro-importar-vazoes.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { UNIDADE_DO_POSTO } from "../src/lib/regulacao-importacao.ts";

const vazoes = JSON.parse(readFileSync(".postoseguro/vazoes.json", "utf8"));

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
  let atualizadas = 0;
  let comVazao = 0;
  let naoAchadas = 0;
  const semUnidade = new Set();
  await cliente.query("begin");
  for (const v of vazoes) {
    const unidade = porNome.get(UNIDADE_DO_POSTO[v.posto_id] ?? "");
    if (!unidade) {
      semUnidade.add(v.posto_id);
      continue;
    }
    const r = await cliente.query(
      `update public.manutencao_afericoes
         set realizada_em = $3, vazao_alta_ml = $4, vazao_baixa_ml = $5
       where unidade_id = $1 and origem_id = $2`,
      [unidade, v.origem_id, v.realizada_em, v.vazao_alta_ml, v.vazao_baixa_ml],
    );
    if (r.rowCount === 0) naoAchadas += 1;
    else {
      atualizadas += 1;
      if (v.vazao_alta_ml != null && v.vazao_baixa_ml != null) comVazao += 1;
    }
  }
  if (semUnidade.size)
    throw new Error(`Sem unidade correspondente para: ${[...semUnidade].join(", ")}`);
  await cliente.query("commit");
  console.log(
    `Pronto: ${atualizadas} aferições atualizadas com a hora (${comVazao} com vazão); ${naoAchadas} do arquivo não estavam no sistema.`,
  );
} catch (e) {
  await cliente.query("rollback");
  console.error(`Falhou; nada foi gravado. Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
