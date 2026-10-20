import { formatarTombamento } from "./regras";

// Regras do inventário que a tela usa; a gravação de cada leitura é do banco (patrimonio_ler).

/** Número do tombamento a partir do QR, do leitor USB ou do que foi digitado. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d{1,12}$/.test(limpo)) return null;
  const n = Number(limpo);
  return n > 0 ? n : null;
}

export type BemLido = { id?: string; tombamento: number; nome: string; empresa: string };

export type ResultadoLeitura =
  | { status: "encontrado" | "ja_lido" | "outra_empresa" | "em_transito" | "baixado"; bem: BemLido }
  | { status: "nao_existe"; numero: number };

export type Aviso = { tom: "certo" | "atencao" | "erro"; titulo: string; texto: string };

export function avisoDaLeitura(r: ResultadoLeitura): Aviso {
  if (r.status === "nao_existe")
    return {
      tom: "erro",
      titulo: formatarTombamento(r.numero),
      texto: "Não existe bem com este número.",
    };
  const titulo = `${formatarTombamento(r.bem.tombamento)} · ${r.bem.nome}`;
  switch (r.status) {
    case "encontrado":
      return { tom: "certo", titulo, texto: "Encontrado." };
    case "ja_lido":
      return { tom: "atencao", titulo, texto: "Já tinha sido lido neste inventário." };
    case "outra_empresa":
      return {
        tom: "atencao",
        titulo,
        texto: `Este bem é de ${r.bem.empresa}. Não conta neste inventário.`,
      };
    case "em_transito":
      return { tom: "atencao", titulo, texto: "Este bem está em trânsito. Não conta." };
    case "baixado":
      return { tom: "erro", titulo, texto: "Este bem foi baixado. Não conta." };
  }
}

type BemDoInventario = { id: string; situacao: string };
type Leitura = { bemId: string; comDefeito: boolean; foraDaEmpresa: boolean };

/** Esperados são os bens da empresa em uso ou com defeito (sem baixados nem em trânsito). */
export function resumoInventario(bensDaEmpresa: BemDoInventario[], leituras: Leitura[]) {
  const esperados = bensDaEmpresa.filter(
    (b) => b.situacao === "em_uso" || b.situacao === "com_defeito",
  );
  const lidos = new Set(leituras.filter((l) => !l.foraDaEmpresa).map((l) => l.bemId));
  return {
    esperados: esperados.length,
    encontrados: esperados.filter((b) => lidos.has(b.id)).length,
    naoEncontrados: esperados.filter((b) => !lidos.has(b.id)).map((b) => b.id),
    comDefeito: leituras.filter((l) => l.comDefeito && !l.foraDaEmpresa).length,
    foraDaEmpresa: leituras.filter((l) => l.foraDaEmpresa).length,
  };
}
