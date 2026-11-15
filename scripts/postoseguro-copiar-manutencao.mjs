// Copia do Posto Seguro as drenagens de tanque e as aferições de bombas e bicos dos 9 postos Lemon
// para .postoseguro/manutencao.json. Abre o Edge: se pedir login, faça-o na janela (a senha não
// passa pelo programa). Os dados lidos ficam só na memória até a lista limpa ser gravada.
// Uso: node scripts/postoseguro-copiar-manutencao.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const SITE = "https://sistema.postoseguro.com/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SAIDA = ".postoseguro";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const depois = (s) =>
  String(s ?? "")
    .split("__LOOKUP__")
    .pop();
// O Posto Seguro guarda as datas como instante: o dia certo é o de Brasília.
const dia = (t) =>
  t ? new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "";

const PRODUTOS = {
  diesel_s_10: "Diesel S-10",
  diesel_s_500: "Diesel S-500",
  diesel_s__10_a_: "Diesel S-10 aditivado",
  gasolina_comum: "Gasolina Comum",
  gasolina_aditivada: "Gasolina Aditivada",
  etanol: "Etanol",
  gnv: "GNV",
};
const produtoDe = (chave) =>
  PRODUTOS[chave] ??
  String(chave ?? "")
    .replace(/_+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const TIPOS = [
  "custom.rede",
  "custom.posto",
  "custom.drenagens",
  "custom.tanques",
  "custom.bomba",
  "custom.0_itens",
  "custom.relat_rios_rotinaa",
];
const registros = Object.fromEntries(TIPOS.map((t) => [t, new Map()]));
function ler(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return o.forEach(ler);
  if (o._source && registros[o._type]) registros[o._type].set(depois(o._id), o._source);
  for (const v of Object.values(o)) ler(v);
}

const navegador = await puppeteer.launch({
  executablePath: EDGE,
  headless: false,
  defaultViewport: null,
  userDataDir: join(tmpdir(), "postoseguro-edge"),
  args: ["--start-maximized"],
});
const pagina = (await navegador.pages())[0] ?? (await navegador.newPage());
let respostas = 0;
pagina.on("response", async (res) => {
  try {
    if (!/\/elasticsearch\/(search|msearch|mget)/.test(res.url())) return;
    ler(JSON.parse((await res.buffer()).toString("utf8")));
    respostas += 1;
  } catch {
    // resposta sem corpo
  }
});

console.log(
  "Edge aberto. Se pedir login, faça-o na janela. Depois não mexa: o programa percorre os postos.",
);
await pagina.goto(SITE, { waitUntil: "domcontentloaded" });
await pagina.waitForFunction(() => location.pathname.includes("index_rede_web"), {
  timeout: 15 * 60 * 1000,
  polling: 1000,
});
await dormir(6000);

const lemon = [...registros["custom.rede"].entries()].find(([, r]) =>
  /lemon/i.test(r.nome_text ?? ""),
);
if (!lemon) throw new Error("Não achei a rede Lemon nos dados do site.");
const postos = [...registros["custom.posto"].entries()]
  .filter(([, p]) => depois(p.rede_custom_rede) === lemon[0])
  .map(([id, p]) => ({ id, nome: p.nomme_fantasia_text || p.apelido_text || id }));
console.log(`Postos da rede Lemon encontrados: ${postos.length}`);

// Rola a página e qualquer área com rolagem própria, até o site parar de carregar mais.
async function rolar() {
  let parados = 0;
  let antes = respostas;
  for (let i = 0; i < 60 && parados < 4; i++) {
    await pagina.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      for (const el of document.querySelectorAll("*")) {
        if (
          el.scrollHeight > el.clientHeight + 20 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY)
        ) {
          el.scrollTop = el.scrollHeight;
        }
      }
    });
    await dormir(1500);
    await pagina.evaluate(() => window.scrollBy(0, -400));
    await dormir(700);
    parados = respostas === antes ? parados + 1 : 0;
    antes = respostas;
  }
}

const contar = (tipo, postoId) =>
  [...registros[tipo].values()].filter((r) => depois(r.posto_custom_posto) === postoId).length;

// Clica no elemento clicável cujo texto bate com a expressão (só botões de consulta).
async function clicarTexto(rx) {
  return pagina
    .evaluate((src) => {
      const re = new RegExp(src, "i");
      for (const el of document.querySelectorAll("*")) {
        const t = (el.innerText ?? "").trim();
        if (!t || t.length > 40 || el.children.length > 2) continue;
        if (re.test(t) && getComputedStyle(el).cursor === "pointer") {
          el.click();
          return true;
        }
      }
      return false;
    }, rx.source)
    .catch(() => false);
}

async function abrir(tela, postoId) {
  await pagina
    .goto(`${SITE}${tela}/${postoId}`, { waitUntil: "networkidle2", timeout: 90000 })
    .catch(() => {});
  await dormir(4000);
}

for (const p of postos) {
  // Duas passadas: o site carrega as listas de forma irregular.
  for (let passada = 0; passada < 2; passada++) {
    await abrir("home_posto-web", p.id); // tanques e bombas
    await abrir("drenagem_web", p.id);
    await clicarTexto(/^hist[óo]rico$/); // abre todas as drenagens
    await dormir(5000);
    await rolar();
    await abrir("afericao", p.id);
    await clicarTexto(/continuar/i); // aviso de novidade, se aparecer
    await dormir(1500);
    await clicarTexto(/^relat[óo]rios$/);
    await dormir(4000);
    for (const aba of [/simplificadas/i, /completas/i, /baldes/i]) {
      if (await clicarTexto(aba)) {
        await dormir(4000);
        await rolar();
      }
    }
  }
  console.log(
    `  ${p.nome}: ${contar("custom.drenagens", p.id)} drenagens, ${contar("custom.relat_rios_rotinaa", p.id)} aferições, ${contar("custom.tanques", p.id)} tanques, ${contar("custom.bomba", p.id)} bombas`,
  );
}
await navegador.close().catch(() => {});

const ids = new Set(postos.map((p) => p.id));
const doPosto = (r) => ids.has(depois(r.posto_custom_posto));

// Tanques reais (os de número 9753 e capacidade 0 são o botão "adicionar" da tela).
const tanques = new Map(
  [...registros["custom.tanques"].entries()].filter(
    ([, t]) => t.capacidade_number > 0 && t.ordem_number !== 9753,
  ),
);
const bombas = new Map(
  [...registros["custom.bomba"].entries()].filter(([, b]) => b.ilha_number !== 9753),
);

const drenagens = [];
const semTanque = [];
for (const [id, r] of registros["custom.drenagens"]) {
  if (!doPosto(r) || !r.datacoleta_date) continue;
  const t = tanques.get(depois(r.tanque_custom_tanques));
  const tanque = t ? String(t.ordem_number) : "";
  if (!tanque) semTanque.push(id);
  drenagens.push({
    origem_id: id,
    posto_id: depois(r.posto_custom_posto),
    data: dia(r.datacoleta_date),
    tanque: tanque || "?",
    produto: produtoDe(r.produto_option_tipo_combustivel),
    capacidade_litros: r.capacidade_number ?? null,
    volume_amostra_litros: r.volumeamostra_number ?? null,
    volume_agua_litros: r.volumeagua_number ?? null,
    tem_agua: !!r.presagua_boolean,
    aspecto_normal: r.aspecto_boolean ?? null,
    cor: (r.cor_text ?? "").trim() || null,
    medida_adotada: (r.medidaadotada_text ?? "").trim() || null,
    responsavel: (r.responsavel_text ?? "").trim() || null,
    rg_responsavel: (r.rgresp_text ?? "").trim() || null,
    dados_origem: {
      tanque_origem: depois(r.tanque_custom_tanques),
      produto_chave: r.produto_option_tipo_combustivel ?? null,
      pres_agua_mm: r.pres__agua_mm_boolean ?? null,
    },
  });
}

const afericoes = [];
let semBico = 0;
for (const [id, r] of registros["custom.relat_rios_rotinaa"]) {
  if (!doPosto(r) || !r.data_date) continue;
  const bico = registros["custom.0_itens"].get(depois(r.bico_custom_0_itens));
  const bomba = bombas.get(depois(r.bomba_custom_bomba));
  if (!bico || !bomba) {
    semBico += 1;
    continue;
  }
  afericoes.push({
    origem_id: id,
    posto_id: depois(r.posto_custom_posto),
    data: dia(r.data_date),
    bomba: String(bomba.ilha_number),
    bico: String(bico.posi__o_number ?? bico.indice_number),
    produto: (r.produto_bico_text ?? "").trim() || produtoDe(bico.produto_option_tipo_combustivel),
    responsavel: (r.responsavel_text ?? "").trim() || null,
    obs: "Importada do Posto Seguro (respostas e vazão ficam lá)",
    dados_origem: { ordem: r.ordem_number ?? null },
  });
}

mkdirSync(SAIDA, { recursive: true });
writeFileSync(join(SAIDA, "manutencao.json"), JSON.stringify({ drenagens, afericoes }, null, 1));
console.log(
  `\nPronto: ${drenagens.length} drenagens (${semTanque.length} sem tanque identificado) e ${afericoes.length} aferições (${semBico} sem bomba ou bico).`,
);
