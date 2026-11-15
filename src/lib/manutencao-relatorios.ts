import { formatData, hoje } from "@/lib/gestao";
import {
  formatarLitros,
  formatarVazao,
  horaDaAfericao,
  PERIODO_AFERICAO_DIAS,
  resultadoAfericao,
  situacaoPeriodica,
  TOLERANCIA_VAZAO_ML,
  vazaoDentro,
  type Afericao,
  type Drenagem,
  type ResultadoVazao,
} from "@/lib/manutencao-regras";

// Relatório de um lançamento de drenagem ou de aferição: uma folha A4 pronta para imprimir ou
// salvar em PDF, aberta numa janela própria (fora do layout do sistema).

/** Texto seguro para entrar em HTML (o que vem do banco nunca vira marcação). */
export function escapar(t: string | number | null | undefined): string {
  return String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const simNao = (v: boolean | null | undefined) => (v == null ? "—" : v ? "Sim" : "Não");

const TEXTO_RESULTADO: Record<ResultadoVazao, string> = {
  aprovado: "APROVADO (dentro da tolerância)",
  reprovado: "REPROVADO (fora da tolerância)",
  "sem-resultado": "Não informado",
};

/** "−20 ml (dentro da tolerância)", "+150 ml (fora da tolerância)" ou "Não informado". */
function descricaoVazao(ml: number | null): string {
  const dentro = vazaoDentro(ml);
  if (dentro === null) return "Não informado";
  return `${formatarVazao(ml)} (${dentro ? "dentro" : "fora"} da tolerância)`;
}
const vazio = (t: string | null | undefined) => (t && t.trim() ? t.trim() : "—");

type Linha = [rotulo: string, valor: string];

function pagina(
  titulo: string,
  posto: string,
  linhas: Linha[],
  rodape: string,
  emitidoEm: string,
  assinatura: string,
) {
  const corpo = linhas
    .map(([r, v]) => `<tr><th>${escapar(r)}</th><td>${escapar(v)}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)} — ${escapar(posto)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 24px; }
  header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
  .marca { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #444; }
  h1 { font-size: 22px; margin: 6px 0 2px; text-transform: uppercase; }
  .posto { font-size: 15px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { width: 38%; background: #f1f1f1; font-weight: bold; }
  .assinatura { margin-top: 64px; width: 55%; }
  .assinatura div { border-top: 1px solid #111; padding-top: 6px; font-size: 12px; text-align: center; }
  footer { margin-top: 28px; font-size: 11px; color: #555; }
  .imprimir { position: fixed; top: 12px; right: 12px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
  @media print { .imprimir { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<button class="imprimir" onclick="window.print()">Imprimir / salvar em PDF</button>
<header>
  <div class="marca">Postos Lemon · Gestão com Eficiência</div>
  <h1>${escapar(titulo)}</h1>
  <div class="posto">${escapar(posto)}</div>
</header>
<table>${corpo}</table>
<div class="assinatura"><div>${escapar(assinatura)}</div></div>
<footer>${escapar(rodape)} Emitido em ${escapar(emitidoEm)}.</footer>
</body>
</html>`;
}

export function relatorioDrenagemHtml(d: Drenagem, posto: string, emitidoEm = hoje()): string {
  const linhas: Linha[] = [
    ["Data da coleta", formatData(d.data)],
    ["Tanque", d.tanque],
    ["Produto", d.produto],
    ["Capacidade do tanque", formatarLitros(d.capacidade_litros)],
    ["Volume drenado", formatarLitros(d.volume_amostra_litros)],
    ["Presença de água?", simNao(d.tem_agua)],
    ["Volume de água drenado", formatarLitros(d.volume_agua_litros)],
    ["Água no medidor (mm)?", simNao(d.agua_no_medidor)],
    ["Homogêneo, límpido e isento de material particulado?", simNao(d.aspecto_normal)],
    ["Cor", vazio(d.cor)],
    ["Medida adotada", vazio(d.medida_adotada)],
    ["Responsável", vazio(d.responsavel)],
    ["RG do responsável", vazio(d.rg_responsavel)],
  ];
  const origem = d.origem_id ? "Lançamento importado do Posto Seguro." : "";
  return pagina(
    "Relatório de drenagem de tanque",
    posto,
    linhas,
    origem,
    formatData(emitidoEm),
    "Assinatura do responsável pela análise",
  );
}

export function relatorioAfericaoHtml(a: Afericao, posto: string, emitidoEm = hoje()): string {
  const proxima = situacaoPeriodica(a.data, PERIODO_AFERICAO_DIAS).proxima;
  const resultado = resultadoAfericao(a.vazao_alta_ml, a.vazao_baixa_ml);
  const linhas: Linha[] = [
    ["Data da aferição", formatData(a.data)],
    ["Hora da aferição", horaDaAfericao(a.realizada_em)],
    ["Bomba", a.bomba],
    ["Bico", a.bico],
    ["Produto", a.produto],
    [`Vazão alta (tolerância ± ${TOLERANCIA_VAZAO_ML} ml)`, descricaoVazao(a.vazao_alta_ml)],
    [`Vazão baixa (tolerância ± ${TOLERANCIA_VAZAO_ML} ml)`, descricaoVazao(a.vazao_baixa_ml)],
    ["Resultado da aferição", TEXTO_RESULTADO[resultado]],
    ["Responsável", vazio(a.responsavel)],
    ["Observação", vazio(a.obs)],
    [`Próxima aferição (a cada ${PERIODO_AFERICAO_DIAS} dias)`, formatData(proxima)],
  ];
  const origem =
    a.origem_id && resultado === "sem-resultado"
      ? "Lançamento importado do Posto Seguro; as respostas do questionário ficam lá."
      : a.origem_id
        ? "Lançamento importado do Posto Seguro; as demais respostas do questionário ficam lá."
        : "";
  return pagina(
    "Relatório de aferição de bomba e bico",
    posto,
    linhas,
    origem,
    formatData(emitidoEm),
    "Assinatura do responsável pela aferição",
  );
}

/** Abre o relatório numa janela nova e chama a impressão. Chame direto de um clique. */
export function abrirRelatorio(html: string): boolean {
  const janela = window.open("about:blank", "_blank");
  if (!janela) return false;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
  return true;
}
