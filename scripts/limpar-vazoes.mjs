// Zera as colunas vazao_alta_ml e vazao_baixa_ml das aferições importadas do Posto Seguro (as que
// têm id de origem). Mantém a hora (realizada_em) e todo o resto. Serve para tirar vazões gravadas
// com a leitura errada, antes de importar a leitura conferida. Mostra quantas linhas mudou.
// Uso: node scripts/limpar-vazoes.mjs
import pg from "pg";

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
  const r = await cliente.query(
    `update public.manutencao_afericoes
        set vazao_alta_ml = null, vazao_baixa_ml = null
      where origem_id is not null and (vazao_alta_ml is not null or vazao_baixa_ml is not null)`,
  );
  const { rows } = await cliente.query(
    `select count(*) filter (where vazao_alta_ml is not null) as com_vazao,
            count(*) filter (where realizada_em is not null) as com_hora
       from public.manutencao_afericoes`,
  );
  console.log(
    `Pronto: ${r.rowCount} aferições tiveram a vazão zerada. Agora: ${rows[0].com_vazao} com vazão, ${rows[0].com_hora} com hora.`,
  );
} catch (e) {
  console.error(`Falhou; nada foi alterado. Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
