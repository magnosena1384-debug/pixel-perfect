// Copia do Posto Seguro a hora e o resultado da vazão alta e baixa de cada aferição de bico já
// importada, para .postoseguro/vazoes.json. Abre o Edge: se pedir login, faça-o na janela. O
// programa só abre os relatórios para o site carregar os valores; não preenche nem grava nada.
// Uso: node scripts/postoseguro-copiar-vazoes.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { lerFolhasAfericao } from "../src/lib/postoseguro-leitura.ts";

const SITE = "https://sistema.postoseguro.com/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SAIDA = ".postoseguro";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const depois = (s) =>
  String(s ?? "")
    .split("__LOOKUP__")
    .pop();
const dia = (t) =>
  t ? new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "";

const TIPOS = [
  "custom.rede",
  "custom.posto",
  "custom.relat_rios_rotinaa",
  "custom.resposta",
  "custom.0_itens",
];

// Vazões lidas direto da tela do relatório ("Núm. do Bico: 1 … ALTA: 0 BAIXA: -20 Aprovado").
const lidas = new Map(); // "posto|AAAA-MM-DD|bico" -> { alta, baixa }
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

// Marca cada cartão "Rotina de Aferição … Data: …" da lista e devolve quantos são.
async function marcarCartoes() {
  return pagina.evaluate(() => {
    const re = /^Rotina de Aferi[çc][ãa]o[\s\S]{0,60}Data:\s*\d/i;
    const achados = [];
    for (const el of document.querySelectorAll("*")) {
      const t = (el.innerText ?? "").trim();
      if (!t || t.length > 200 || !re.test(t)) continue;
      if ([...el.children].some((c) => re.test((c.innerText ?? "").trim()))) continue; // só o mais interno
      // O clique vale no elemento "clicável" que envolve o texto (cursor de mão), não no texto.
      let alvo = el;
      while (alvo && getComputedStyle(alvo).cursor !== "pointer") alvo = alvo.parentElement;
      const escolhido = alvo ?? el;
      if (!achados.includes(escolhido)) achados.push(escolhido);
    }
    achados.forEach((el, i) => el.setAttribute("data-cartao-vazao", String(i)));
    return achados.length;
  });
}

for (const p of postos) {
  for (let passada = 0; passada < 2; passada++) {
    await pagina
      .goto(`${SITE}afericao/${p.id}`, { waitUntil: "networkidle2", timeout: 90000 })
      .catch(() => {});
    await dormir(4000);
    await clicarTexto(/continuar/i);
    await dormir(1500);
    await clicarTexto(/^relat[óo]rios$/);
    await dormir(4000);
    if (!(await clicarTexto(/simplificadas/i))) continue;
    await dormir(4000);
    await rolar();
    const n = await marcarCartoes();
    for (let i = 0; i < n; i++) {
      const seletor = `[data-cartao-vazao="${i}"]`;
      await pagina
        .evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), seletor)
        .catch(() => {});
      const cartao = await pagina
        .evaluate((s) => document.querySelector(s)?.innerText ?? "", seletor)
        .catch(() => "");
      const dCartao = cartao.match(/Data:\s*(\d{2}\/\d{2})\/(\d{2})/);
      const esperada = dCartao ? `${dCartao[1]}/20${dCartao[2]}` : null;
      await pagina.click(seletor).catch(() => {});
      await dormir(2000);
      // Espera o relatório novo aparecer: a folha dele imprime a data completa (dd/mm/aaaa). Sem
      // isso a leitura pegava o relatório anterior, ainda na tela, e seguia em frente.
      if (esperada) {
        await pagina
          .waitForFunction(
            (d) =>
              document.body.innerText.includes("AFERIÇÃO BOMBAS") &&
              document.body.innerText.includes(d),
            { timeout: 30000, polling: 1000 },
            esperada,
          )
          .catch(() => {});
      }
      // A tela só desenha os bicos que cabem na janela: lê, rola até o fim e lê de novo, até
      // parar de aparecer bico novo.
      let semNovos = 0;
      for (let volta = 0; volta < 20 && semNovos < 3; volta++) {
        const texto = await pagina.evaluate(() => document.body.innerText).catch(() => "");
        let novos = 0;
        for (const b of lerFolhasAfericao(texto)) {
          // A data é a impressa na folha, não a do cartão clicado: a tela às vezes ainda mostra
          // o relatório anterior quando a leitura acontece.
          const chave = `${p.id}|${b.data}|${b.bico}`;
          if (!lidas.has(chave)) novos += 1;
          lidas.set(chave, { alta: b.alta, baixa: b.baixa });
        }
        semNovos = novos === 0 ? semNovos + 1 : 0;
        await pagina
          .evaluate(() => {
            window.scrollBy(0, 700);
            for (const el of document.querySelectorAll("*")) {
              if (
                el.scrollHeight > el.clientHeight + 20 &&
                /(auto|scroll)/.test(getComputedStyle(el).overflowY)
              )
                el.scrollTop += 700;
            }
          })
          .catch(() => {});
        await dormir(1200);
      }
    }
  }
  const dele = [...registros["custom.relat_rios_rotinaa"].values()].filter(
    (r) => depois(r.posto_custom_posto) === p.id,
  ).length;
  const comVazao = [...lidas.keys()].filter((k) => k.startsWith(p.id)).length;
  console.log(`  ${p.nome}: ${dele} aferições, ${comVazao} vazões lidas da tela`);
}
await navegador.close().catch(() => {});

// Segunda fonte, independente: as respostas do questionário que o site entrega como dados. Serve
// para conferir a leitura da tela; onde as duas existem, vale o dado do site.
const dosDados = new Map();
for (const r of registros["custom.resposta"].values()) {
  if (r.vazaoalta_number == null || r.vazaobaixa_number == null || !r.data1_date) continue;
  const b = registros["custom.0_itens"].get(depois(r.bico_custom_0_itens));
  const numero = b ? (b.posi__o_number ?? b.indice_number) : null;
  if (numero == null) continue;
  dosDados.set(`${depois(r.posto_custom_posto)}|${dia(r.data1_date)}|${numero}`, {
    alta: r.vazaoalta_number,
    baixa: r.vazaobaixa_number,
  });
}
let concordam = 0;
const discordam = [];
for (const [chave, d] of dosDados) {
  const l = lidas.get(chave);
  if (!l) continue;
  if (l.alta === d.alta && l.baixa === d.baixa) concordam += 1;
  else discordam.push(`${chave}: tela ${l.alta}/${l.baixa}, dados ${d.alta}/${d.baixa}`);
}
console.log(
  `\nConferência entre a tela e os dados do site: ${concordam} concordam, ${discordam.length} discordam.`,
);
for (const d of discordam.slice(0, 10)) console.log("  discorda:", d);
for (const [chave, d] of dosDados) lidas.set(chave, d);

// Liga cada vazão lida ao seu relatório: mesmo posto, mesmo dia e mesmo número de bico.
const vazoes = [];
let ligadas = 0;
for (const [id, r] of registros["custom.relat_rios_rotinaa"]) {
  if (!r.data_date || !r.bico_custom_0_itens) continue;
  const bicoRegistro = registros["custom.0_itens"].get(depois(r.bico_custom_0_itens));
  const numero = bicoRegistro ? (bicoRegistro.posi__o_number ?? bicoRegistro.indice_number) : null;
  const postoId = depois(r.posto_custom_posto);
  const lida = numero == null ? undefined : lidas.get(`${postoId}|${dia(r.data_date)}|${numero}`);
  if (lida) ligadas += 1;
  vazoes.push({
    origem_id: id,
    posto_id: postoId,
    realizada_em: new Date(r.data_date).toISOString(),
    vazao_alta_ml: lida?.alta ?? null,
    vazao_baixa_ml: lida?.baixa ?? null,
  });
}
mkdirSync(SAIDA, { recursive: true });
writeFileSync(join(SAIDA, "vazoes.json"), JSON.stringify(vazoes, null, 1));
console.log(
  `\nPronto: ${vazoes.length} aferições com hora; ${ligadas} ligadas a uma vazão lida da tela (${lidas.size} leituras no total).`,
);
