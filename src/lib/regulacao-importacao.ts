// Regras da importação dos documentos do Posto Seguro para a Regulação. Sem dependências: o
// programa scripts/postoseguro-importar.mjs também carrega este arquivo.

/** Posto do Posto Seguro → nome da unidade no sistema (pelo número romano e pelo CNPJ). */
export const UNIDADE_DO_POSTO: Record<string, string> = {
  "1676378412277x474270687898632200": "Posto Lemon I - Satélite",
  "1767895966877x567491330816081900": "Posto Lemon II - Neópolis",
  "1767896175352x613952347619983400": "Posto Lemon III - Av.9",
  "1767896258119x337446382792605700": "Posto Lemon IV - Carrasco",
  "1676378322801x352582632880472060": "Posto Lemon V - Nevaldo/Tororos",
  "1677677200136x864572651562336300": "Posto Lemon VI - Km.6",
  "1676637635053x499162887684096000": "Posto Lemon VII - Alecrim",
  "1654008833847x786074592827670500": "Posto Lemon VIII - Gancho",
  "1678984156559x376416085667741700": "Posto Lemon IX - Alexandrino",
};

export type ItemPostoSeguro = {
  id: string;
  posto_id: string;
  tipo: "documento" | "certificado";
  orgao: string;
  nome: string;
  validade: string; // AAAA-MM-DD
  prazo_limite: string; // AAAA-MM-DD ou ""
  avisar_dias: number;
  arquivo_nome: string;
};

/** Dias de `de` até `ate` (datas AAAA-MM-DD), sem efeito de fuso. */
export function diasEntre(de: string, ate: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(ate) - t(de)) / 86_400_000);
}

/** "2027-11-23" → "23/11/2027". */
export function dataBr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Quantos dias antes da validade o sistema deve avisar. O Posto Seguro avisa a partir do prazo
 * limite (que pode ser anterior à validade): o aviso daqui começa no mesmo dia que o de lá.
 */
export function avisarDias(validade: string, prazoLimite: string, aviso: number): number {
  const folga = prazoLimite ? Math.max(0, diasEntre(prazoLimite, validade)) : 0;
  return folga + (Number.isFinite(aviso) && aviso >= 0 ? aviso : 30);
}

/** Documento da Regulação (sem o arquivo, que a função de importação anexa). */
export function montarDocumento(x: ItemPostoSeguro) {
  const partes = ["Importado do Posto Seguro"];
  if (x.prazo_limite) partes.push(`prazo para renovar: ${dataBr(x.prazo_limite)}`);
  return {
    id: `ps-${x.id}`,
    orgao: x.orgao,
    nome: x.nome,
    numero: "",
    emissao: "",
    validade: x.validade,
    avisar_dias: avisarDias(x.validade, x.prazo_limite, x.avisar_dias),
    obs: partes.join(" · "),
  };
}
