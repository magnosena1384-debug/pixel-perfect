import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ResultadoLeitura } from "./inventario";

// Leitura e gravação do patrimônio. Quem vê o quê e quem grava é regra do banco: as telas só
// chamam as funções patrimonio_* e leem as tabelas.

export type SituacaoBem = "em_uso" | "com_defeito" | "em_transito" | "baixado";

export type Bem = {
  id: string;
  tombamento: number;
  unidadeId: string;
  setor: string;
  nome: string;
  categoria: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  dataCompra: string;
  valorCompra: number; // centavos
  vidaUtilAnos: number;
  situacao: SituacaoBem;
  baixaData: string | null;
  baixaMotivo: string | null;
  reimprimirEtiqueta: boolean;
};

export type DadosBem = Pick<
  Bem,
  | "setor"
  | "nome"
  | "categoria"
  | "marca"
  | "modelo"
  | "numeroSerie"
  | "dataCompra"
  | "valorCompra"
  | "vidaUtilAnos"
> & { situacao: "em_uso" | "com_defeito" };

type Linha = {
  id: string;
  tombamento: number;
  unidade_id: string;
  setor: string;
  nome: string;
  categoria: string;
  marca: string;
  modelo: string;
  numero_serie: string | null;
  data_compra: string;
  valor_compra_centavos: number;
  vida_util_anos: number;
  situacao: string;
  baixa_data: string | null;
  baixa_motivo: string | null;
  reimprimir_etiqueta: boolean;
};

function paraBem(l: Linha): Bem {
  return {
    id: l.id,
    tombamento: l.tombamento,
    unidadeId: l.unidade_id,
    setor: l.setor,
    nome: l.nome,
    categoria: l.categoria,
    marca: l.marca,
    modelo: l.modelo,
    numeroSerie: l.numero_serie ?? "",
    dataCompra: l.data_compra,
    valorCompra: Number(l.valor_compra_centavos),
    vidaUtilAnos: l.vida_util_anos,
    situacao: l.situacao as SituacaoBem,
    baixaData: l.baixa_data,
    baixaMotivo: l.baixa_motivo,
    reimprimirEtiqueta: l.reimprimir_etiqueta,
  };
}

/** Todos os bens que o usuário pode ver (o banco filtra pelas empresas dele). */
export function useBens() {
  return useQuery({
    queryKey: ["patrimonio", "bens"],
    queryFn: async () => {
      const bens: Bem[] = [];
      // O banco devolve no máximo 1000 linhas por vez.
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from("patrimonio_bens")
          .select("*")
          .order("tombamento")
          .range(desde, desde + 999);
        if (error) throw error;
        bens.push(...data.map(paraBem));
        if (data.length < 1000) return bens;
      }
    },
  });
}

export function useBem(id: string) {
  return useQuery({
    queryKey: ["patrimonio", "bem", id],
    queryFn: async () => {
      const [bem, historico] = await Promise.all([
        supabase.from("patrimonio_bens").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("patrimonio_historico")
          .select("id, quando, quem_nome, evento, detalhe")
          .eq("bem_id", id)
          .order("quando", { ascending: false }),
      ]);
      if (bem.error) throw bem.error;
      if (historico.error) throw historico.error;
      return { bem: bem.data ? paraBem(bem.data) : null, historico: historico.data };
    },
  });
}

function paraBanco(d: DadosBem) {
  return {
    setor: d.setor,
    nome: d.nome,
    categoria: d.categoria,
    marca: d.marca,
    modelo: d.modelo,
    numero_serie: d.numeroSerie,
    data_compra: d.dataCompra,
    valor_compra_centavos: d.valorCompra,
    vida_util_anos: d.vidaUtilAnos,
    situacao: d.situacao,
  };
}

export type Repetido = { id: string; tombamento: number; nome: string; empresa: string };

/** Cadastra; se o nº de série já existe, devolve o bem repetido sem gravar (a menos de confirmar). */
export async function cadastrarBem(unidadeId: string, dados: DadosBem, confirmarRepetido = false) {
  const { data, error } = await supabase.rpc("patrimonio_cadastrar", {
    _unidade: unidadeId,
    _dados: { ...paraBanco(dados), confirmar_serie_repetida: confirmarRepetido } as Json,
  });
  if (error) throw error;
  return data as { id: string; tombamento: number } | { repetido: Repetido };
}

export async function editarBem(id: string, dados: DadosBem) {
  const { error } = await supabase.rpc("patrimonio_editar", {
    _id: id,
    _dados: paraBanco(dados) as Json,
  });
  if (error) throw error;
}

/** Registra no histórico que as etiquetas foram impressas e tira os bens da lista de reimpressão. */
export async function registrarEtiquetasImpressas(ids: string[]) {
  const { error } = await supabase.rpc("patrimonio_etiquetas_impressas", { _ids: ids });
  if (error) throw error;
}

// ---------- Inventário ----------

export type LeituraInventario = {
  bemId: string;
  lidoEm: string;
  comDefeito: boolean;
  semEtiqueta: boolean;
  foraDaEmpresa: boolean;
  aviso: string;
};

/** Inventário aberto da empresa (ou null) e as leituras dele. */
export function useInventarioAberto(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ["patrimonio", "inventario", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: inv, error } = await supabase
        .from("patrimonio_inventarios")
        .select("id, aberto_em, aberto_por_nome")
        .eq("unidade_id", unidadeId!)
        .is("fechado_em", null)
        .maybeSingle();
      if (error) throw error;
      if (!inv) return null;
      const { data: leituras, error: e2 } = await supabase
        .from("patrimonio_leituras")
        .select("bem_id, lido_em, com_defeito, sem_etiqueta, fora_da_empresa, aviso")
        .eq("inventario_id", inv.id)
        .order("lido_em", { ascending: false });
      if (e2) throw e2;
      return {
        ...inv,
        leituras: leituras.map((l): LeituraInventario => ({
          bemId: l.bem_id,
          lidoEm: l.lido_em,
          comDefeito: l.com_defeito,
          semEtiqueta: l.sem_etiqueta,
          foraDaEmpresa: l.fora_da_empresa,
          aviso: l.aviso,
        })),
      };
    },
  });
}

async function rpc<T>(chamada: PromiseLike<{ data: unknown; error: Error | null }>) {
  const { data, error } = await chamada;
  if (error) throw error;
  return data as T;
}

export const abrirInventario = (unidadeId: string) =>
  rpc<string>(supabase.rpc("patrimonio_abrir_inventario", { _unidade: unidadeId }));

export const lerEtiqueta = (inventarioId: string, tombamento: number) =>
  rpc<ResultadoLeitura>(
    supabase.rpc("patrimonio_ler", { _inventario: inventarioId, _tombamento: tombamento }),
  );

export const marcarDefeito = (inventarioId: string, bemId: string, defeito: boolean) =>
  rpc<null>(
    supabase.rpc("patrimonio_marcar_defeito", {
      _inventario: inventarioId,
      _bem: bemId,
      _defeito: defeito,
    }),
  );

export const bemSemEtiqueta = (inventarioId: string, bemId: string) =>
  rpc<null>(supabase.rpc("patrimonio_sem_etiqueta", { _inventario: inventarioId, _bem: bemId }));

export type RelatorioInventario = {
  encontrados: number;
  nao_encontrados: string[];
  com_defeito: number;
  fora_da_empresa: number;
};

export const fecharInventario = (inventarioId: string) =>
  rpc<RelatorioInventario>(
    supabase.rpc("patrimonio_fechar_inventario", { _inventario: inventarioId }),
  );

// ---------- Empresas e transferências ----------

/** Id e nome de todas as empresas do grupo (para o destino e para os nomes nas listas). */
export function useEmpresasDoGrupo() {
  return useQuery({
    queryKey: ["patrimonio", "empresas"],
    staleTime: 5 * 60_000,
    queryFn: () =>
      rpc<{ id: string; nome: string }[]>(supabase.rpc("patrimonio_empresas_do_grupo")),
  });
}

export type Transferencia = {
  id: string;
  bemId: string;
  origemId: string;
  destinoId: string;
  situacao: "em_transito" | "recebida" | "cancelada";
  observacao: string;
  enviadoEm: string;
  enviadoPorNome: string;
  concluidoEm: string | null;
  concluidoPorNome: string | null;
};

/** Transferências das empresas que a pessoa vê (como origem ou destino), as mais novas primeiro. */
export function useTransferencias() {
  return useQuery({
    queryKey: ["patrimonio", "transferencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patrimonio_transferencias")
        .select("*")
        .order("enviado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data.map((t): Transferencia => ({
        id: t.id,
        bemId: t.bem_id,
        origemId: t.origem_id,
        destinoId: t.destino_id,
        situacao: t.situacao as Transferencia["situacao"],
        observacao: t.observacao,
        enviadoEm: t.enviado_em,
        enviadoPorNome: t.enviado_por_nome,
        concluidoEm: t.concluido_em,
        concluidoPorNome: t.concluido_por_nome,
      }));
    },
  });
}

export const transferirBem = (bemId: string, destinoId: string, observacao: string) =>
  rpc<string>(
    supabase.rpc("patrimonio_transferir", {
      _bem: bemId,
      _destino: destinoId,
      _observacao: observacao,
    }),
  );

export const receberTransferencia = (id: string) =>
  rpc<null>(supabase.rpc("patrimonio_receber", { _transferencia: id }));

export const cancelarTransferencia = (id: string) =>
  rpc<null>(supabase.rpc("patrimonio_cancelar_transferencia", { _transferencia: id }));
