import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeusAcessos, type Permissao } from "@/lib/gestao";
import type { VendaFuncionario } from "./indicadores";
import {
  diaParaBanco,
  type BancoHoras,
  type DiaPonto,
  type Irregularidade,
  type Relatorio,
} from "./planilha";

export type DiaPontoDaUnidade = DiaPonto & { unidadeId: string };
export type IrregularidadeDaUnidade = Irregularidade & { unidadeId: string };
export type BancoHorasDaUnidade = BancoHoras & { unidadeId: string; referencia: string };

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
      const [ponto, irr, saldos] = await Promise.all([
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
        // O banco de horas é uma foto (a última importada), não depende do período.
        todasAsPaginas((a, b) =>
          supabase
            .from("rh_banco_horas")
            .select("*")
            .in("unidade_id", unidadeIds)
            .order("unidade_id")
            .order("colaborador")
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
      const banco: BancoHorasDaUnidade[] = saldos.map((b) => ({
        unidadeId: b.unidade_id,
        colaborador: b.colaborador,
        nome: b.nome,
        setor: b.setor,
        admissao: b.admissao,
        credito: b.credito_min,
        debito: b.debito_min,
        saldo: b.saldo_min,
        referencia: b.referencia,
      }));
      return { dias, irregularidades, banco };
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
  const base = { _unidade: unidadeId, _arquivo: arquivo };
  const periodo = { ...base, _de: relatorio.de, _ate: relatorio.ate };
  const { data, error } =
    relatorio.tipo === "frequencia"
      ? await supabase.rpc("rh_gravar_ponto", {
          ...periodo,
          _dias: relatorio.dias.map(diaParaBanco),
        })
      : relatorio.tipo === "irregularidades"
        ? await supabase.rpc("rh_gravar_irregularidades", {
            ...periodo,
            _linhas: relatorio.irregularidades,
          })
        : await supabase.rpc("rh_gravar_banco_horas", {
            ...base,
            _referencia: relatorio.referencia,
            _linhas: relatorio.linhas,
          });
  if (error) throw error;
  return data;
}

/** Vendas do webPosto por funcionário no período, para o ticket médio (somadas no banco). */
export function useVendasRh(de: string, ate: string, ligado: boolean) {
  return useQuery({
    queryKey: ["rh", "vendas", de, ate],
    enabled: ligado,
    queryFn: async (): Promise<VendaFuncionario[]> => {
      const linhas = await todasAsPaginas((a, b) =>
        supabase
          .rpc("rh_ticket_vendas", { _de: de, _ate: ate })
          .order("unidade_id")
          .order("nome")
          .range(a, b),
      );
      return linhas.map((l) => ({
        unidadeId: l.unidade_id,
        cpf: l.cpf,
        nome: l.nome,
        total: Number(l.total),
        cupons: Number(l.cupons),
      }));
    },
  });
}
