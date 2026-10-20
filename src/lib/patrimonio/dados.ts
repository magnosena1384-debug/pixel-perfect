import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
