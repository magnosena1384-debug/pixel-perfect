// Copia os documentos e certificados dos 9 postos Lemon do Posto Seguro para .postoseguro/:
//   documentos.json  (lista limpa: posto, tipo, nome, validade, prazo, aviso, endereço do PDF)
//   arquivos/<posto>/<id>.pdf  (os PDFs baixados)
// Abre o Edge: se o login ainda não estiver feito, faça-o na janela (a senha não passa pelo programa).
// Os dados lidos ficam só na memória; nada com senha é gravado. Uso: node scripts/postoseguro-copiar.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
// O Posto Seguro guarda as datas como instante (em geral 23h59 no horário do Brasil): o dia certo
// é o de Brasília, não o do UTC (que cairia um dia depois).
const dia = (t) =>
  t ? new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "";

// Tipos de documento do Posto Seguro (chave interna → nome e órgão na Regulação). O que não
// está aqui entra com a chave em maiúsculas e órgão "Outro".
const TIPOS = {
  certificado_de_coleta_de_res_duos: [
    "Certificado de coleta de resíduos sólidos",
    "Secretaria do Meio Ambiente",
  ],
  cri: ["Certificado de regularidade IBAMA (CRI)", "Secretaria do Meio Ambiente"],
  an_lise_de_tog: ["Análise de TOG (teor de óleos e graxas)", "Secretaria do Meio Ambiente"],
  pgr: ["PGR – Plano de Gerenciamento de Riscos", "Outro"],
  cpr: ["CPR – Certificado de posto revendedor", "Outro"],
  spda: ["SPDA – Sistema de proteção contra descargas atmosféricas", "Corpo de Bombeiros"],
  term_metro_petr_leo: ["Termômetro petróleo", "Outro"],
  term_metro_etanol: ["Termômetro etanol", "Outro"],
  dens_metro_gas__com__700_a_750: ["Densímetro gasolina comum 700 a 750", "Outro"],
  dens_metro_gas__com__750_a_800: ["Densímetro gasolina comum 750 a 800", "Outro"],
  dens_metro_etanol_750_a_800: ["Densímetro etanol 750 a 800", "Outro"],
  dens_metro_etanol_770_a_820: ["Densímetro etanol 770 a 820", "Outro"],
  dens_metro_etanol_800_a_850: ["Densímetro etanol 800 a 850", "Outro"],
  dens_metro_d_esel_800_a_850: ["Densímetro diesel 800 a 850", "Outro"],
  dens_metro_d_esel_850_a_900: ["Densímetro diesel 850 a 900", "Outro"],
  avcb: ["AVCB – Auto de vistoria do Corpo de Bombeiros", "Corpo de Bombeiros"],
  pcmso: ["PCMSO – Programa de controle médico de saúde ocupacional", "Outro"],
  lo: ["Licença de operação (LO)", "Secretaria do Meio Ambiente"],
  af: ["Alvará de funcionamento", "Prefeitura"],
  teste_de_estanqueidade: ["Teste de estanqueidade dos tanques", "Secretaria do Meio Ambiente"],
  contrato_social: ["Contrato social", "Outro"],
  ltcat: ["LTCAT – Laudo técnico das condições ambientais do trabalho", "Outro"],
  validade_proveta_100ml: ["Validade da proveta de 100 ml", "Outro"],
  planta_sasc: ["Planta do SASC – Sistema de armazenamento subterrâneo de combustíveis", "Outro"],
  memorial_descritivo: ["Memorial descritivo", "Outro"],
  habite_se: ["Habite-se", "Prefeitura"],
  certificado_de_posto_revendedor___glp: ["Certificado de posto revendedor (GLP)", "ANP"],
  rapp___relat_rio_de_atividades_potencialmente_poluidoras: [
    "RAPP – Relatório de atividades potencialmente poluidoras",
    "Secretaria do Meio Ambiente",
  ],
  aferi__es_de_bomba: ["Aferições de bomba", "Outro"],
  aferi__es_do_balde_aferidor: ["Aferições do balde aferidor", "Outro"],
  teste_estanq__gnv: ["Teste de estanqueidade GNV", "Outro"],
  term_metro_biocombust_veis: ["Termômetro biocombustíveis", "Outro"],
  termodens_metro_do_flutuador_etanol_2: ["Termodensímetro do flutuador etanol 2", "Outro"],
  termodens_metro_do_flutuador_etanol_3: ["Termodensímetro do flutuador etanol 3", "Outro"],
  termodens_metro_do_flutuador_etanol_4: ["Termodensímetro do flutuador etanol 4", "Outro"],
  termodens_metro_do_flutuador_etanol_5: ["Termodensímetro do flutuador etanol 5", "Outro"],
  termodens_metro_do_flutuador_etanol_6: ["Termodensímetro do flutuador etanol 6", "Outro"],
  reclassifica__o_cilindro___gnv: ["Reclassificação do cilindro GNV", "Outro"],
  lavagem_e_manuten__o_da_caixa_separadora__sao_: [
    "Lavagem e manutenção da caixa separadora (SAO)",
    "Secretaria do Meio Ambiente",
  ],
  termodens_metro_do_flutuador_etanol: ["Termodensímetro do flutuador etanol 1", "Outro"],
  entrega_do_rapp: ["Entrega do RAPP", "Secretaria do Meio Ambiente"],
  nr___20: ["NR-20", "Outro"],
};
const tipoDe = (chave) => TIPOS[chave] ?? [String(chave ?? "documento").toUpperCase(), "Outro"];

// Registros lidos das respostas do site (só na memória).
const registros = {
  "custom.rede": new Map(),
  "custom.posto": new Map(),
  "custom.registro_documentos": new Map(),
  "custom.registro_certificados": new Map(),
};
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
  .map(([id, p]) => ({
    id,
    nome: p.nomme_fantasia_text || p.apelido_text || id,
    cnpj: String(p.cnpj_text ?? "").replace(/\D/g, ""),
  }));
console.log(`Postos da rede Lemon encontrados: ${postos.length}`);

async function rolar() {
  let parados = 0;
  let antes = respostas;
  for (let i = 0; i < 40 && parados < 4; i++) {
    await pagina.evaluate(() => window.scrollBy(0, -600));
    await dormir(800);
    await pagina.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await dormir(1500);
    parados = respostas === antes ? parados + 1 : 0;
    antes = respostas;
  }
}

for (const p of postos) {
  // Duas passadas por tela: o site carrega as listas de forma irregular.
  for (const tela of ["documentos_web", "certificados_web", "documentos_web", "certificados_web"]) {
    await pagina
      .goto(`${SITE}${tela}/${p.id}`, { waitUntil: "networkidle2", timeout: 90000 })
      .catch(() => {});
    await dormir(4000);
    await rolar();
  }
  const d = [...registros["custom.registro_documentos"].values()].filter(
    (r) => depois(r.posto_custom_posto) === p.id,
  ).length;
  const c = [...registros["custom.registro_certificados"].values()].filter(
    (r) => depois(r.posto_custom_posto) === p.id,
  ).length;
  console.log(`  ${p.nome}: ${d} documentos, ${c} certificados`);
}
await navegador.close().catch(() => {});

// Lista limpa: só o que a Regulação precisa.
const lista = [];
for (const [tabela, tipo] of [
  ["custom.registro_documentos", "documento"],
  ["custom.registro_certificados", "certificado"],
]) {
  for (const [id, r] of registros[tabela]) {
    const posto = postos.find((p) => p.id === depois(r.posto_custom_posto));
    if (!posto) continue;
    const chave =
      tipo === "documento" ? r.doc_option_documentos : r.certificado_option_certificados;
    if (!chave) continue;
    const [nomeTipo, orgao] = tipoDe(chave);
    const validade = dia(tipo === "documento" ? r.data_date : r.validade_date);
    const limite = tipo === "documento" ? dia(r.datalim_date) : "";
    const avisos = Array.isArray(r.warn_list_number) ? r.warn_list_number : [];
    const arquivo = r.arquivo_file ? String(r.arquivo_file).replace(/^\/\//, "https://") : "";
    lista.push({
      id,
      posto_id: posto.id,
      posto: posto.nome,
      cnpj: posto.cnpj,
      tipo,
      chave,
      orgao,
      nome:
        tipo === "certificado"
          ? `${nomeTipo} – ${r.funcion_rio_text || "(sem nome informado)"}`
          : nomeTipo,
      funcionario: r.funcion_rio_text ?? "",
      validade,
      prazo_limite: limite && limite !== validade ? limite : "",
      avisar_dias: avisos.length ? Math.max(...avisos) : 30,
      arquivo_url: arquivo,
      arquivo_nome: arquivo ? decodeURIComponent(arquivo.split("?")[0].split("/").pop() ?? "") : "",
    });
  }
}
mkdirSync(SAIDA, { recursive: true });
// Leituras anteriores: o que o site não devolveu desta vez continua na lista, para não perder
// documento.
if (existsSync(join(SAIDA, "documentos.json"))) {
  const vistos = new Set(lista.map((d) => d.id));
  const antes = JSON.parse(readFileSync(join(SAIDA, "documentos.json"), "utf8"));
  for (const d of antes) if (!vistos.has(d.id)) lista.push(d);
}
writeFileSync(join(SAIDA, "documentos.json"), JSON.stringify(lista, null, 1));

// PDFs (endereços públicos do servidor de arquivos do Bubble).
let baixados = 0;
const falhas = [];
const fila = lista.filter((d) => d.arquivo_url);
async function baixar(d) {
  const pasta = join(SAIDA, "arquivos", d.posto_id);
  mkdirSync(pasta, { recursive: true });
  const destino = join(pasta, `${d.id}.pdf`);
  if (existsSync(destino)) return;
  try {
    const res = await fetch(d.arquivo_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const corpo = Buffer.from(await res.arrayBuffer());
    writeFileSync(destino, corpo);
    d.sha256 = createHash("sha256").update(corpo).digest("hex");
    d.bytes = corpo.length;
    baixados += 1;
  } catch (e) {
    falhas.push(`${d.posto} / ${d.nome}: ${e.message}`);
  }
}
for (let i = 0; i < fila.length; i += 4) await Promise.all(fila.slice(i, i + 4).map(baixar));
writeFileSync(join(SAIDA, "documentos.json"), JSON.stringify(lista, null, 1));

console.log(
  `\nPronto: ${lista.length} itens (${lista.filter((d) => d.tipo === "documento").length} documentos, ${lista.filter((d) => d.tipo === "certificado").length} certificados).`,
);
console.log(
  `PDFs: ${fila.length} com arquivo, ${baixados} baixados agora, ${falhas.length} falhas, ${lista.length - fila.length} sem arquivo.`,
);
for (const f of falhas) console.log("  falha:", f);
