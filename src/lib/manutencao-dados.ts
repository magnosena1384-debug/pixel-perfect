import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Afericao, Drenagem } from "@/lib/manutencao-regras";

// Acesso às tabelas manutencao_drenagens e manutencao_afericoes (migração 0024).

const PAGINA = 1000; // a API do banco devolve no máximo 1000 linhas por vez

const COLUNAS_DRENAGEM =
  "id, data, tanque, produto, capacidade_litros, volume_amostra_litros, volume_agua_litros, tem_agua, aspecto_normal, cor, medida_adotada, responsavel, rg_responsavel, origem_id, dados_origem";
const COLUNAS_AFERICAO = "id, data, bomba, bico, produto, responsavel, obs, origem_id";

/** Resposta "Água no medidor/mm?" guardada em dados_origem.pres_agua_mm. */
export function aguaNoMedidor(dados: unknown): boolean | null {
  if (!dados || typeof dados !== "object") return null;
  const v = (dados as Record<string, unknown>)["pres_agua_mm"];
  return typeof v === "boolean" ? v : null;
}

async function lerDrenagens(unidadeId: string): Promise<Drenagem[]> {
  const linhas: Drenagem[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("manutencao_drenagens")
      .select(COLUNAS_DRENAGEM)
      .eq("unidade_id", unidadeId)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    // "Água no medidor/mm?" fica em dados_origem (veio assim do Posto Seguro).
    for (const { dados_origem, ...resto } of data)
      linhas.push({ ...resto, agua_no_medidor: aguaNoMedidor(dados_origem) });
    if (data.length < PAGINA) break;
  }
  return linhas;
}

async function lerAfericoes(unidadeId: string): Promise<Afericao[]> {
  const linhas: Afericao[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("manutencao_afericoes")
      .select(COLUNAS_AFERICAO)
      .eq("unidade_id", unidadeId)
      .order("data", { ascending: false })
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < PAGINA) break;
  }
  return linhas;
}

export function useDrenagens(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ["manutencao", "drenagens", unidadeId],
    enabled: !!unidadeId,
    queryFn: () => lerDrenagens(unidadeId!),
  });
}

export function useAfericoes(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ["manutencao", "afericoes", unidadeId],
    enabled: !!unidadeId,
    queryFn: () => lerAfericoes(unidadeId!),
  });
}

export type NovaDrenagem = Omit<Drenagem, "id" | "origem_id">;

/** Linha para gravar: a pergunta do medidor vai em dados_origem, como nas importadas. */
function linhaDrenagem(d: NovaDrenagem, unidadeId: string) {
  const { agua_no_medidor, ...resto } = d;
  return { ...resto, unidade_id: unidadeId, dados_origem: { pres_agua_mm: agua_no_medidor } };
}
export type NovaAfericao = Omit<Afericao, "id" | "origem_id">;

export function useGravarManutencao(unidadeId: string | undefined) {
  const qc = useQueryClient();
  const atualizar = () => qc.invalidateQueries({ queryKey: ["manutencao"] });
  return {
    async lancarDrenagem(d: NovaDrenagem) {
      if (!unidadeId) return;
      const { error } = await supabase
        .from("manutencao_drenagens")
        .insert(linhaDrenagem(d, unidadeId));
      if (error) throw new Error(error.message);
      await atualizar();
    },
    async excluirDrenagem(id: string) {
      const { error } = await supabase.from("manutencao_drenagens").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await atualizar();
    },
    async lancarAfericao(a: NovaAfericao) {
      if (!unidadeId) return;
      const { error } = await supabase
        .from("manutencao_afericoes")
        .insert({ ...a, unidade_id: unidadeId });
      if (error) throw new Error(error.message);
      await atualizar();
    },
    async excluirAfericao(id: string) {
      const { error } = await supabase.from("manutencao_afericoes").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await atualizar();
    },
  };
}
