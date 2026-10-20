import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeusAcessos, type Permissao } from "@/lib/gestao";
import { diaParaBanco, type DiaPonto, type RelatorioFrequencia } from "./planilha";

export type DiaPontoDaUnidade = DiaPonto & { unidadeId: string };

/** Unidades em que o usuário tem a permissão pedida, na ordem do cadastro. */
export function useUnidadesCom(permissao: Permissao) {
  const { data, isLoading } = useMeusAcessos();
  const unidades = (data?.unidades ?? []).filter((u) => data?.modulos.get(u.id)?.has(permissao));
  return { unidades, isLoading };
}

/** Dias de ponto do período nas unidades pedidas. A regra de quem vê mora no banco. */
export function usePontoRh(de: string, ate: string, unidadeIds: string[]) {
  return useQuery({
    queryKey: ["rh", "ponto", de, ate, unidadeIds],
    enabled: unidadeIds.length > 0,
    queryFn: async () => {
      const dias: DiaPontoDaUnidade[] = [];
      // O banco devolve no máximo 1000 linhas por vez.
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from("rh_ponto_dias")
          .select("*")
          .in("unidade_id", unidadeIds)
          .gte("data", de)
          .lte("data", ate)
          .order("unidade_id")
          .order("colaborador")
          .order("data")
          .range(desde, desde + 999);
        if (error) throw error;
        dias.push(
          ...data.map((d) => ({
            unidadeId: d.unidade_id,
            colaborador: d.colaborador,
            nome: d.nome,
            data: d.data,
            jornada: d.jornada,
            batidas: d.batidas,
            diurna: d.diurna_min,
            noturna: d.noturna_min,
            extras: d.extras_min,
            extras100: d.extras100_min,
            hn: d.hn_min,
            descontos: d.descontos_min,
            observacao: d.observacao,
            folga: d.folga,
            trabalhou: d.trabalhou,
          })),
        );
        if (data.length < 1000) break;
      }
      return dias;
    },
  });
}

export function useImportacoesRh(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ["rh", "importacoes", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_importacoes")
        .select("id, relatorio, arquivo, periodo_de, periodo_ate, quantidade, criado_em")
        .eq("unidade_id", unidadeId!)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

/** Troca o período do arquivo pelos dias lidos, tudo ou nada. Devolve quantos dias gravou. */
export async function gravarFrequencia(
  unidadeId: string,
  arquivo: string,
  relatorio: RelatorioFrequencia,
) {
  const { data, error } = await supabase.rpc("rh_gravar_ponto", {
    _unidade: unidadeId,
    _arquivo: arquivo,
    _de: relatorio.de,
    _ate: relatorio.ate,
    _dias: relatorio.dias.map(diaParaBanco),
  });
  if (error) throw error;
  return data;
}
