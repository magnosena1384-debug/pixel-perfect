// Abre o Edge no Posto Seguro para VOCÊ fazer o login e navegar pelas telas de documentos.
// Enquanto isso, o programa só observa: guarda em .postoseguro/ o que as telas carregam (listas em
// JSON, páginas e arquivos baixados) e uma foto de cada tela, para eu aprender a estrutura do site.
// Não guarda senha, cookies nem o que você digita; respostas de login são ignoradas.
// A pasta .postoseguro/ tem dados pessoais e fica fora do Git. Para terminar, feche a janela.
// Uso: node scripts/postoseguro-explorar.mjs
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const SITE = "https://sistema.postoseguro.com/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SAIDA = ".postoseguro";
const SEGREDO = /login|logon|signin|auth|token|senha|password|sessao|session|recuper/i;
const LIMITE = 30 * 1024 * 1024;

for (const d of ["respostas", "telas", "baixados"]) mkdirSync(join(SAIDA, d), { recursive: true });

let n = 0;
let telas = 0;
const registro = (linha) =>
  appendFileSync(join(SAIDA, "manifesto.jsonl"), JSON.stringify(linha) + "\n");
const nome = (url) =>
  new URL(url).pathname
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "raiz";
const extensao = (tipo) =>
  tipo.includes("json")
    ? "json"
    : tipo.includes("html")
      ? "html"
      : tipo.includes("pdf")
        ? "pdf"
        : tipo.includes("zip")
          ? "zip"
          : tipo.includes("sheet") || tipo.includes("excel")
            ? "xlsx"
            : "bin";

const navegador = await puppeteer.launch({
  executablePath: EDGE,
  headless: false,
  defaultViewport: null,
  userDataDir: join(tmpdir(), "postoseguro-edge"),
  args: ["--start-maximized"],
});

// Arquivos que o site mandar baixar vão para .postoseguro/baixados.
const sessao = await navegador.target().createCDPSession();
await sessao
  .send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: join(process.cwd(), SAIDA, "baixados"),
  })
  .catch(() => {});

function observar(pagina) {
  pagina.on("response", async (res) => {
    try {
      const url = res.url();
      if (!/postoseguro\.com/i.test(url)) return;
      const tipo = (res.headers()["content-type"] ?? "").toLowerCase();
      const recurso = res.request().resourceType();
      const arquivo =
        /pdf|zip|excel|spreadsheet|octet-stream|msword|officedocument|image\/(jpeg|png)/.test(tipo);
      if (!arquivo && !["xhr", "fetch", "document"].includes(recurso)) return;
      if (SEGREDO.test(url)) {
        registro({ url: url.split("?")[0], ignorado: "parece login" });
        return;
      }
      const corpo = await res.buffer();
      if (corpo.length > LIMITE || corpo.length === 0) return;
      n += 1;
      const arq = `${String(n).padStart(4, "0")}-${nome(url)}.${extensao(tipo)}`;
      writeFileSync(join(SAIDA, "respostas", arq), corpo);
      registro({
        n,
        url,
        metodo: res.request().method(),
        status: res.status(),
        tipo,
        bytes: corpo.length,
        arq,
      });
    } catch {
      // resposta sem corpo (redirecionamento) ou página fechando: segue
    }
  });
  pagina.on("load", async () => {
    try {
      if (telas >= 80) return;
      await new Promise((r) => setTimeout(r, 1500));
      telas += 1;
      const arq = `${String(telas).padStart(3, "0")}-${nome(pagina.url())}.png`;
      await pagina.screenshot({ path: join(SAIDA, "telas", arq), fullPage: true });
      registro({ tela: arq, url: pagina.url() });
    } catch {
      // página fechou antes da foto
    }
  });
}

navegador.on("targetcreated", async (alvo) => {
  const pagina = await alvo.page().catch(() => null);
  if (pagina) observar(pagina);
});
for (const p of await navegador.pages()) observar(p);

const primeira = (await navegador.pages())[0] ?? (await navegador.newPage());
await primeira.goto(SITE);

console.log("Janela do Edge aberta. Faça o login nela, abra os documentos de cada posto");
console.log("e baixe um documento de exemplo. Quando terminar, FECHE a janela do Edge.");

await new Promise((resolve) => navegador.on("disconnected", resolve));
console.log(`Pronto: ${n} respostas e ${telas} telas guardadas em ${SAIDA}/`);
