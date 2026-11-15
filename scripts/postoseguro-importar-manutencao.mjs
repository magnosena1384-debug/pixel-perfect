// Grava no sistema as drenagens e aferições copiadas do Posto Seguro (.postoseguro/manutencao.json)
// nas tabelas manutencao_drenagens e manutencao_afericoes (migração 0024). Pode rodar mais de uma
// vez: cada registro tem o id de origem, e o que já existe é atualizado, não duplicado.
// Uso: node scripts/postoseguro-importar-manutencao.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { UNIDADE_DO_POSTO } from "../src/lib/regulacao-importacao.ts";

const { drenagens, afericoes } = JSON.parse(readFileSync(".postoseguro/manutencao.json", "utf8"));

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
  const unidadeDe = (postoId) => porNome.get(UNIDADE_DO_POSTO[postoId] ?? "");
  const semUnidade = new Set();
  const contagem = {};
  const conta = (postoId, tipo) => {
    const nome = UNIDADE_DO_POSTO[postoId];
    (contagem[nome] ??= { drenagens: 0, afericoes: 0 })[tipo] += 1;
  };

  await cliente.query("begin");
  let novasD = 0;
  for (const d of drenagens) {
    const unidade = unidadeDe(d.posto_id);
    if (!unidade) {
      semUnidade.add(d.posto_id);
      continue;
    }
    const r = await cliente.query(
      `insert into public.manutencao_drenagens
         (unidade_id, origem_id, data, tanque, produto, capacidade_litros, volume_amostra_litros,
          volume_agua_litros, tem_agua, aspecto_normal, cor, medida_adotada, responsavel,
          rg_responsavel, dados_origem)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (unidade_id, origem_id) where origem_id is not null do update set
         data = excluded.data, tanque = excluded.tanque, produto = excluded.produto,
         capacidade_litros = excluded.capacidade_litros,
         volume_amostra_litros = excluded.volume_amostra_litros,
         volume_agua_litros = excluded.volume_agua_litros, tem_agua = excluded.tem_agua,
         aspecto_normal = excluded.aspecto_normal, cor = excluded.cor,
         medida_adotada = excluded.medida_adotada, responsavel = excluded.responsavel,
         rg_responsavel = excluded.rg_responsavel, dados_origem = excluded.dados_origem
       returning (xmax = 0) as nova`,
      [
        unidade,
        d.origem_id,
        d.data,
        d.tanque,
        d.produto,
        d.capacidade_litros,
        d.volume_amostra_litros,
        d.volume_agua_litros,
        d.tem_agua,
        d.aspecto_normal,
        d.cor,
        d.medida_adotada,
        d.responsavel,
        d.rg_responsavel,
        JSON.stringify(d.dados_origem ?? null),
      ],
    );
    if (r.rows[0]?.nova) novasD += 1;
    conta(d.posto_id, "drenagens");
  }

  let novasA = 0;
  for (const a of afericoes) {
    const unidade = unidadeDe(a.posto_id);
    if (!unidade) {
      semUnidade.add(a.posto_id);
      continue;
    }
    const r = await cliente.query(
      `insert into public.manutencao_afericoes
         (unidade_id, origem_id, data, bomba, bico, produto, responsavel, obs, dados_origem)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (unidade_id, origem_id) where origem_id is not null do update set
         data = excluded.data, bomba = excluded.bomba, bico = excluded.bico,
         produto = excluded.produto, responsavel = excluded.responsavel, obs = excluded.obs,
         dados_origem = excluded.dados_origem
       returning (xmax = 0) as nova`,
      [
        unidade,
        a.origem_id,
        a.data,
        a.bomba,
        a.bico,
        a.produto,
        a.responsavel,
        a.obs,
        JSON.stringify(a.dados_origem ?? null),
      ],
    );
    if (r.rows[0]?.nova) novasA += 1;
    conta(a.posto_id, "afericoes");
  }

  if (semUnidade.size)
    throw new Error(`Sem unidade correspondente para: ${[...semUnidade].join(", ")}`);
  await cliente.query("commit");
  console.log(
    `Pronto: ${novasD} drenagens novas (de ${drenagens.length}) e ${novasA} aferições novas (de ${afericoes.length}).`,
  );
  for (const [nome, c] of Object.entries(contagem))
    console.log(`  ${nome}: ${c.drenagens} drenagens, ${c.afericoes} aferições`);
} catch (e) {
  await cliente.query("rollback");
  console.error(`Falhou; nada foi gravado. Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
