import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeusAcessos, type Permissao } from "@/lib/gestao";
import { diaParaBanco, type DiaPonto, type Irregularidade, type Relatorio } from "./planilha";

export type DiaPontoDaUnidade = DiaPonto & { unidadeId: string };
export type IrregularidadeDaUnidade = Irregularidade & { unidadeId: string };

/** Unidades em que o usuário tem a permissão pedida, na ordem do cadastro. */
export function useUnidadesCom(permissao: Permissao) {
  const { data, isLoading } = useMeusAcessos();
  const unidades = (data?.unidades ?? []).filter((u) => data?.modulos.get(u.id)?.has(permissao));
  return { unidades, isLoading };
}

/** Lê todas as páginas: o banco devolve no máximo 1000 linhas por vez. */
async function todasAsPaginas<T>(
  pagina: (desde: number, ate: number) => PromiseLike<{ data: T[] | null; error: Error | null }>,
) {
  const linhas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await pagina(desde, desde + 999);
    if (error) throw error;
    linhas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return linhas;
  }
}

/** Ponto e irregularidades do período nas unidades pedidas. Quem vê o quê é regra do banco. */
export function useDadosRh(de: string, ate: string, unidadeIds: string[]) {
  return useQuery({
    queryKey: ["rh", "dados", de, ate, unidadeIds],
    enabled: unidadeIds.length > 0,
    queryFn: async () => {
      const [ponto, irr] = await Promise.all([
        todasAsPaginas((a, b) =>
          supabase
            .from("rh_ponto_dias")
            .select("*")
            .in("unidade_id", unidadeIds)
            .gte("data", de)
            .lte("data", ate)
            .order("unidade_id")
            .order("colaborador")
            .order("data")
            .range(a, b),
        ),
        todasAsPaginas((a, b) =>
          supabase
            .from("rh_irregularidades")
            .select("*")
            .in("unidade_id", unidadeIds)
            .gte("data", de)
            .lte("data", ate)
            .order("unidade_id")
            .order("colaborador")
            .order("tipo")
            .order("data")
            .range(a, b),
        ),
      ]);
      const dias: DiaPontoDaUnidade[] = ponto.map((d) => ({
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
      }));
      const irregularidades: IrregularidadeDaUnidade[] = irr.map((i) => ({
        unidadeId: i.unidade_id,
        colaborador: i.colaborador,
        nome: i.nome,
        cpf: i.cpf,
        cargo: i.cargo,
        setor: i.setor,
        vinculo: i.vinculo,
        tipo: i.tipo,
        data: i.data,
      }));
      return { dias, irregularidades };
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

/** Troca o período do arquivo pelo que foi lido, tudo ou nada. Devolve quantos registros gravou. */
export async function gravarImportacao(unidadeId: string, arquivo: string, relatorio: Relatorio) {
  const base = { _unidade: unidadeId, _arquivo: arquivo, _de: relatorio.de, _ate: relatorio.ate };
  const { data, error } =
    relatorio.tipo === "frequencia"
      ? await supabase.rpc("rh_gravar_ponto", { ...base, _dias: relatorio.dias.map(diaParaBanco) })
      : await supabase.rpc("rh_gravar_irregularidades", {
          ...base,
          _linhas: relatorio.irregularidades,
        });
  if (error) throw error;
  return data;
}
