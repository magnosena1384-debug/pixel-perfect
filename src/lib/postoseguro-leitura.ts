// Leitura do texto do relatório de aferição do Posto Seguro. Sem dependências: o programa
// scripts/postoseguro-copiar-vazoes.mjs também carrega este arquivo.

export type VazaoLida = {
  /** Data impressa na própria folha ("Data: 27/04/2026"), AAAA-MM-DD. */
  data: string;
  bico: number;
  alta: number;
  baixa: number;
};

/** "27/04/2026" ou "27/04/26" → "2026-04-27". */
function isoDeData(dd: string, mm: string, aa: string): string {
  return `${aa.length === 2 ? `20${aa}` : aa}-${mm}-${dd}`;
}

/**
 * O relatório vem em folhas ("AFERIÇÃO BOMBAS"). Cada folha traz os bicos, um depois do outro
 * ("Prod.: … / Núm. do Bico: N / Resp.: … / (escalas) / ALTA: x / BAIXA: y / Aprovado"), e termina
 * com "Elaborado por … Data: dd/mm/aaaa". A data vem da própria folha: a tela às vezes ainda mostra
 * o relatório anterior, então a data do cartão clicado não é confiável.
 *
 * A tela só entrega o texto de parte dos números de cada vez, então pode haver cabeçalho de bico
 * sem o par ALTA/BAIXA. Cada bico só recebe o par que está dentro do seu próprio bloco (do "Núm. do
 * Bico" até o próximo "Prod."); sem par no bloco, o bico fica de fora. Folha sem data é ignorada.
 * Os valores positivos vêm com o sinal de mais.
 */
export function lerFolhasAfericao(texto: string): VazaoLida[] {
  const saida: VazaoLida[] = [];
  for (const folha of texto.split(/AFERI[ÇC][ÃA]O BOMBAS/i).slice(1)) {
    const d = folha.match(/Data:\s*(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (!d) continue;
    const data = isoDeData(d[1]!, d[2]!, d[3]!);
    for (const parte of folha.split(/(?=N[úu]m\. do Bico:)/).slice(1)) {
      const bico = parte.match(/^N[úu]m\. do Bico:\s*(\d+)/)?.[1];
      if (bico === undefined) continue;
      const bloco = parte.split(/Prod\.:|Elaborado por/i)[0] ?? "";
      const par = bloco.match(/ALTA:\s*([+-]?\d+)\s*BAIXA:\s*([+-]?\d+)/);
      if (par)
        saida.push({ data, bico: Number(bico), alta: Number(par[1]), baixa: Number(par[2]) });
    }
  }
  return saida;
}

/** "Data: 27/04/26" no texto de um cartão → "2026-04-27"; null se não houver. */
export function dataDoCartao(texto: string): string | null {
  const m = texto.match(/Data:\s*(\d{2})\/(\d{2})\/(\d{2})/);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null;
}
