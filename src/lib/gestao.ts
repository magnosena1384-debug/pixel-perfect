import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Dados da área de gestão: ficam na tabela gestao_itens, separados por unidade.

export type Venda = {
  id: string;
  data: string;
  // Campos opcionais: vendas registradas antes do dashboard não os têm.
  hora?: string;
  colaborador?: string;
  produto: string;
  litros: number | null;
  valor_centavos: number;
  pagamento: string;
  obs: string;
};

export type Rotina = {
  id: string;
  titulo: string;
  frequencia_dias: number;
  responsavel: string;
  ultima_execucao: string | null;
};

export type PedidoStatus = "solicitado" | "confirmado" | "entregue" | "cancelado";

export type Pedido = {
  id: string;
  data: string;
  fornecedor: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valor_centavos: number;
  previsao_entrega: string;
  nota_fiscal: string;
  status: PedidoStatus;
};

export type Documento = {
  id: string;
  orgao: string;
  nome: string;
  numero: string;
  emissao: string;
  validade: string;
  avisar_dias: number;
  obs: string;
};

export type Inspecao = {
  data: string;
  resultado: "ok" | "problema";
  responsavel: string;
  obs: string;
};

export type ItemManutencao = {
  id: string;
  categoria: string;
  nome: string;
  periodicidade_dias: number;
  historico: Inspecao[];
};

export const PRODUTOS = [
  "Gasolina comum",
  "Gasolina aditivada",
  "Etanol",
  "Diesel S10",
  "Diesel S500",
  "GNV",
  "Lubrificantes",
  "Conveniência",
  "Outros",
];

export const COMBUSTIVEIS = PRODUTOS.slice(0, 6);

export type Tipo = "combustivel" | "produtos";

export function tipoProduto(produto: string): Tipo {
  return COMBUSTIVEIS.includes(produto) ? "combustivel" : "produtos";
}

export const PAGAMENTOS = ["Dinheiro", "PIX", "Débito", "Crédito", "Frota / faturado"];

export const ORGAOS = [
  "ANP",
  "Corpo de Bombeiros",
  "Tributação",
  "Procon",
  "Secretaria do Meio Ambiente",
  "Prefeitura",
  "Outro",
];

// Sugestões de documentos por órgão (o usuário pode digitar qualquer outro).
export const DOCUMENTOS_SUGERIDOS: Record<string, string[]> = {
  ANP: ["Autorização de revenda varejista", "Cadastro de bandeira / bandeira branca"],
  "Corpo de Bombeiros": [
    "AVCB — Auto de Vistoria",
    "CLCB — Certificado de Licença",
    "Recarga de extintores",
    "Treinamento de brigada",
  ],
  Tributação: [
    "CND Federal (Receita/PGFN)",
    "CND Estadual (SEFAZ)",
    "CND Municipal",
    "Certificado digital e-CNPJ",
    "CRF FGTS",
  ],
  Procon: ["Exemplar do CDC disponível", "Registro / cadastro no Procon municipal"],
  "Secretaria do Meio Ambiente": [
    "Licença de Operação (LO)",
    "Teste de estanqueidade dos tanques",
    "Monitoramento de poços",
    "Destinação de resíduos (MTR)",
  ],
  Prefeitura: ["Alvará de funcionamento", "Alvará sanitário"],
};

export const CATEGORIAS_MANUTENCAO = [
  "Bombas",
  "Filtros",
  "Canaletas",
  "Elétrica",
  "Caixa separadora",
  "Iluminação",
  "Adesivos ANP",
];

export const ROTINAS_SUGERIDAS: Omit<Rotina, "id">[] = [
  { titulo: "Fechamento de caixa", frequencia_dias: 1, responsavel: "", ultima_execucao: null },
  {
    titulo: "Medição dos tanques e atualização do LMC",
    frequencia_dias: 1,
    responsavel: "",
    ultima_execucao: null,
  },
  { titulo: "Depósito bancário", frequencia_dias: 1, responsavel: "", ultima_execucao: null },
  {
    titulo: "Conferência de estoque da conveniência",
    frequencia_dias: 7,
    responsavel: "",
    ultima_execucao: null,
  },
  { titulo: "Escala de frentistas", frequencia_dias: 7, responsavel: "", ultima_execucao: null },
  { titulo: "Folha de pagamento", frequencia_dias: 30, responsavel: "", ultima_execucao: null },
  {
    titulo: "Apuração e envio de impostos",
    frequencia_dias: 30,
    responsavel: "",
    ultima_execucao: null,
  },
];

function item(categoria: string, nome: string, periodicidade_dias: number): ItemManutencao {
  return { id: uid(), categoria, nome, periodicidade_dias, historico: [] };
}

// Lista inicial editável; confirme periodicidades e exigências com a legislação local.
export function manutencaoPadrao(): ItemManutencao[] {
  return [
    item("Bombas", "Aferição volumétrica (medida padrão 20 L)", 30),
    item("Bombas", "Vazamentos, mangueiras, bicos e breakaway", 7),
    item("Bombas", "Lacres e verificação INMETRO", 365),
    item("Filtros", "Troca dos filtros das bombas de diesel", 90),
    item("Filtros", "Troca dos filtros das bombas de gasolina/etanol", 180),
    item("Canaletas", "Limpeza e desobstrução das canaletas", 7),
    item("Elétrica", "Quadro elétrico e disjuntores", 180),
    item("Elétrica", "Aterramento e SPDA (para-raios)", 365),
    item("Caixa separadora", "Limpeza da caixa separadora água/óleo", 30),
    item("Caixa separadora", "Retirada de resíduos por empresa licenciada", 90),
    item("Iluminação", "Iluminação da pista e cobertura", 30),
    item("Iluminação", "Iluminação de emergência", 90),
    item("Adesivos ANP", "Painel de preços visível da via pública", 30),
    item("Adesivos ANP", "Identificação do combustível em cada bico", 30),
    item("Adesivos ANP", "Razão social, CNPJ, nº de autorização ANP e bandeira", 90),
    item("Adesivos ANP", "Telefone do Centro de Relações com o Consumidor da ANP", 90),
    item("Adesivos ANP", "Avisos de segurança (proibido fumar, celular, motor desligado)", 90),
  ];
}

// ---------- Datas ----------

let sequencia = 0;

// Ids crescentes (tempo + sequência): a ordem alfabética dos ids é a ordem de criação.
export function uid() {
  sequencia = (sequencia + 1) % 1296;
  return `${Date.now().toString(36)}${sequencia.toString(36).padStart(2, "0")}${Math.random().toString(36).slice(2, 6)}`;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoje() {
  return iso(new Date());
}

function parse(data: string) {
  const [y, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDias(data: string, dias: number) {
  const d = parse(data);
  d.setDate(d.getDate() + dias);
  return iso(d);
}

export function diasAte(data: string, base = hoje()) {
  return Math.round((parse(data).getTime() - parse(base).getTime()) / 864e5);
}

export function formatData(data: string | null | undefined) {
  if (!data) return "—";
  return parse(data).toLocaleDateString("pt-BR");
}

export function reaisParaCentavos(v: string) {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function horaAtual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- Indicadores de vendas ----------

// Cada lançamento conta como um atendimento; ticket médio = total / nº de lançamentos.
export type Resumo = { vendas: number; total: number; litros: number; ticket: number };

export function resumir(vendas: Venda[]): Resumo {
  const total = vendas.reduce((s, v) => s + v.valor_centavos, 0);
  const litros = vendas.reduce((s, v) => s + (v.litros ?? 0), 0);
  return {
    vendas: vendas.length,
    total,
    litros,
    ticket: vendas.length ? Math.round(total / vendas.length) : 0,
  };
}

export type Grupo = { nome: string; geral: Resumo; combustivel: Resumo; produtos: Resumo };

export function agruparVendas<V extends Venda>(vendas: V[], chave: (v: V) => string): Grupo[] {
  const grupos = new Map<string, V[]>();
  for (const v of vendas) {
    const k = chave(v);
    grupos.set(k, [...(grupos.get(k) ?? []), v]);
  }
  return [...grupos]
    .map(([nome, vs]) => ({
      nome,
      geral: resumir(vs),
      combustivel: resumir(vs.filter((v) => tipoProduto(v.produto) === "combustivel")),
      produtos: resumir(vs.filter((v) => tipoProduto(v.produto) === "produtos")),
    }))
    .sort((a, b) => b.geral.total - a.geral.total);
}

// Total em centavos por hora do dia (0–23); vendas sem hora ficam de fora.
export function vendasPorHora(vendas: Venda[]) {
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, combustivel: 0, produtos: 0 }));
  for (const v of vendas) {
    const h = v.hora ? Number(v.hora.slice(0, 2)) : NaN;
    if (!(h >= 0 && h < 24)) continue;
    horas[h]![tipoProduto(v.produto)] += v.valor_centavos;
  }
  return horas;
}

// ---------- Situação e alertas ----------

export type Situacao = "vencido" | "proximo" | "ok" | "sem-data";

export function situacao(vencimento: string | null, avisarDias: number, base = hoje()): Situacao {
  if (!vencimento) return "sem-data";
  const d = diasAte(vencimento, base);
  if (d < 0) return "vencido";
  if (d <= avisarDias) return "proximo";
  return "ok";
}

export function ultimaInspecao(i: ItemManutencao) {
  return i.historico[0]?.data ?? null;
}

export function proximaInspecao(i: ItemManutencao) {
  const u = ultimaInspecao(i);
  return u ? addDias(u, i.periodicidade_dias) : null;
}

export function proximaRotina(r: Rotina) {
  return r.ultima_execucao ? addDias(r.ultima_execucao, r.frequencia_dias) : null;
}

// Aviso antecipado proporcional à periodicidade: itens semanais avisam com 1 dia, anuais com 30.
export function antecedencia(periodicidade: number) {
  return Math.min(30, Math.floor(periodicidade / 4));
}

export type Alerta = {
  id: string;
  tipo: "Documento" | "Manutenção" | "Rotina";
  titulo: string;
  detalhe: string;
  vencimento: string | null;
  situacao: Situacao;
  link: "/gestao/regulacao" | "/gestao/manutencao" | "/gestao/rotinas";
};

export function calcularAlertas(
  docs: Documento[],
  itens: ItemManutencao[],
  rotinas: Rotina[],
  base = hoje(),
): Alerta[] {
  const alertas: Alerta[] = [
    ...docs.map((d) => ({
      id: d.id,
      tipo: "Documento" as const,
      titulo: d.nome,
      detalhe: d.orgao,
      vencimento: d.validade || null,
      situacao: situacao(d.validade || null, d.avisar_dias, base),
      link: "/gestao/regulacao" as const,
    })),
    ...itens.map((i) => {
      const prox = proximaInspecao(i);
      return {
        id: i.id,
        tipo: "Manutenção" as const,
        titulo: i.nome,
        detalhe: i.categoria,
        vencimento: prox,
        // Item nunca inspecionado também precisa de atenção.
        situacao: prox
          ? situacao(prox, antecedencia(i.periodicidade_dias), base)
          : ("vencido" as Situacao),
        link: "/gestao/manutencao" as const,
      };
    }),
    ...rotinas.map((r) => {
      const prox = proximaRotina(r);
      return {
        id: r.id,
        tipo: "Rotina" as const,
        titulo: r.titulo,
        detalhe: r.responsavel || "Sem responsável",
        vencimento: prox,
        situacao: prox ? situacao(prox, 0, base) : ("vencido" as Situacao),
        link: "/gestao/rotinas" as const,
      };
    }),
  ];
  const ordem: Record<Situacao, number> = { vencido: 0, proximo: 1, "sem-data": 2, ok: 3 };
  return alertas
    .filter((a) => a.situacao === "vencido" || a.situacao === "proximo")
    .sort(
      (a, b) =>
        ordem[a.situacao] - ordem[b.situacao] ||
        (a.vencimento ?? "").localeCompare(b.vencimento ?? ""),
    );
}

// ---------- Unidades e acessos ----------

export const MODULOS = [
  { id: "vendas", label: "Vendas", rota: "/gestao/vendas" },
  { id: "rotinas", label: "Rotinas administrativas", rota: "/gestao/rotinas" },
  { id: "pedidos", label: "Pedidos", rota: "/gestao/pedidos" },
  { id: "documentos", label: "Regulação", rota: "/gestao/regulacao" },
  { id: "manutencao", label: "Manutenção e inspeção", rota: "/gestao/manutencao" },
] as const;

export type Modulo = (typeof MODULOS)[number]["id"];
export type Unidade = { id: string; nome: string; ordem: number };

const TODOS_MODULOS = new Set<Modulo>(MODULOS.map((m) => m.id));

export function useMeusAcessos() {
  return useQuery({
    queryKey: ["gestao", "acessos"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user)
        return {
          isAdmin: false,
          unidades: [] as Unidade[],
          modulos: new Map<string, Set<Modulo>>(),
        };
      const [{ data: admin }, { data: unidades, error }, { data: acessos }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.from("unidades").select("id, nome, ordem").order("ordem"),
        supabase.from("gestao_acessos").select("unidade_id, modulos").eq("user_id", user.id),
      ]);
      if (error) throw error;
      const modulos = new Map<string, Set<Modulo>>();
      for (const u of unidades ?? []) {
        const meus = acessos?.find((a) => a.unidade_id === u.id)?.modulos ?? [];
        modulos.set(u.id, admin ? TODOS_MODULOS : new Set(meus as Modulo[]));
      }
      return { isAdmin: !!admin, unidades: unidades ?? [], modulos };
    },
  });
}

const CHAVE_UNIDADE_ATUAL = "gestao:unidade-atual";
const ouvintes = new Set<() => void>();

function lerLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function assinar(cb: () => void) {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

export function useUnidadeAtual() {
  const { data, isLoading } = useMeusAcessos();
  const id = useSyncExternalStore(
    assinar,
    () => lerLocal(CHAVE_UNIDADE_ATUAL),
    () => null,
  );
  const unidades = data?.unidades ?? [];
  const unidade = unidades.find((u) => u.id === id) ?? unidades[0] ?? null;
  const selecionar = useCallback((novo: string) => {
    try {
      localStorage.setItem(CHAVE_UNIDADE_ATUAL, novo);
    } catch {
      // sem armazenamento: a escolha vale só nesta aba
    }
    ouvintes.forEach((l) => l());
  }, []);
  const modulos = (unidade && data?.modulos.get(unidade.id)) || new Set<Modulo>();
  return { unidade, unidades, modulos, selecionar, isAdmin: !!data?.isAdmin, isLoading };
}

// ---------- Dados da gestão (tabela gestao_itens) ----------

/** O que gravar e o que apagar para levar a lista `antes` até `depois`. */
export function diferencas<T extends { id: string }>(antes: T[], depois: T[]) {
  const atuais = new Map(antes.map((i) => [i.id, JSON.stringify(i)]));
  const ficam = new Set(depois.map((i) => i.id));
  return {
    gravar: depois.filter((i) => atuais.get(i.id) !== JSON.stringify(i)),
    apagar: antes.filter((i) => !ficam.has(i.id)).map((i) => i.id),
  };
}

// A lista inicial (ex.: itens de manutenção padrão) só é gravada no primeiro salvamento;
// guardamos uma por unidade para os ids não mudarem a cada leitura.
const sementes = new Map<string, unknown[]>();
function semente<T>(chave: string, seed?: () => T[]) {
  if (!seed) return [] as T[];
  if (!sementes.has(chave)) sementes.set(chave, seed());
  return sementes.get(chave) as T[];
}

export type VendaDaUnidade = Venda & { unidade: string };

/** Vendas de todas as unidades em que o usuário tem acesso a Vendas, com o nome da unidade. */
export function useVendasDasUnidades() {
  const { data: acessos } = useMeusAcessos();
  const permitidas = (acessos?.unidades ?? []).filter((u) =>
    acessos?.modulos.get(u.id)?.has("vendas"),
  );
  return useQuery({
    queryKey: ["gestao", "itens", "vendas-das-unidades", permitidas.map((u) => u.id)],
    enabled: permitidas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gestao_itens")
        .select("id, unidade_id, dados")
        .eq("colecao", "vendas")
        .in(
          "unidade_id",
          permitidas.map((u) => u.id),
        );
      if (error) throw error;
      const nomes = new Map(permitidas.map((u) => [u.id, u.nome]));
      return (data ?? []).map(
        (r) =>
          ({
            ...(r.dados as object),
            id: r.id,
            unidade: nomes.get(r.unidade_id) ?? "",
          }) as VendaDaUnidade,
      );
    },
  });
}

async function buscarItens<T>(unidade: string, colecao: Modulo) {
  const { data, error } = await supabase
    .from("gestao_itens")
    .select("id, dados")
    .eq("unidade_id", unidade)
    .eq("colecao", colecao)
    .order("id");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...(r.dados as object), id: r.id }) as T);
}

export async function gravarDiferencas<T extends { id: string }>(
  unidade: string,
  colecao: Modulo,
  antes: T[],
  depois: T[],
) {
  const { gravar, apagar } = diferencas(antes, depois);
  if (gravar.length) {
    const { error } = await supabase.from("gestao_itens").upsert(
      gravar.map((i) => ({
        id: i.id,
        unidade_id: unidade,
        colecao,
        dados: i as unknown as Json,
        atualizado_em: new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }
  if (apagar.length) {
    const { error } = await supabase
      .from("gestao_itens")
      .delete()
      .eq("unidade_id", unidade)
      .eq("colecao", colecao)
      .in("id", apagar);
    if (error) throw error;
  }
}

export function useColecao<T extends { id: string }>(colecao: Modulo, seed?: () => T[]) {
  const qc = useQueryClient();
  const { unidade, modulos } = useUnidadeAtual();
  const permitido = !!unidade && modulos.has(colecao);
  const chave = ["gestao", "itens", unidade?.id, colecao];
  const { data: salvos = [] } = useQuery({
    queryKey: chave,
    enabled: permitido,
    queryFn: () => buscarItens<T>(unidade!.id, colecao),
  });
  const lista = !permitido
    ? []
    : salvos.length
      ? salvos
      : semente<T>(`${unidade.id}:${colecao}`, seed);

  const salvar = async (update: (atual: T[]) => T[]) => {
    if (!unidade || !permitido) return;
    const novo = update(lista);
    qc.setQueryData(chave, novo);
    try {
      await gravarDiferencas(unidade.id, colecao, salvos, novo);
    } catch (e) {
      toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : "erro"}`);
    }
    void qc.invalidateQueries({ queryKey: chave });
    void qc.invalidateQueries({ queryKey: ["gestao", "alertas"] });
  };
  return [lista, salvar] as const;
}

export function useAlertas() {
  const [docs] = useColecao<Documento>("documentos");
  const [itens] = useColecao<ItemManutencao>("manutencao", manutencaoPadrao);
  const [rotinas] = useColecao<Rotina>("rotinas");
  return calcularAlertas(docs, itens, rotinas);
}

/** Quantidade de alertas por unidade, para o seletor de unidades. */
export function useAlertasPorUnidade() {
  const { data } = useMeusAcessos();
  return useQuery({
    queryKey: ["gestao", "alertas", data?.unidades.map((u) => u.id)],
    enabled: !!data,
    queryFn: async () => {
      const { data: linhas, error } = await supabase
        .from("gestao_itens")
        .select("unidade_id, colecao, id, dados")
        .in("colecao", ["documentos", "manutencao", "rotinas"]);
      if (error) throw error;
      const contagem = new Map<string, number>();
      for (const u of data!.unidades) {
        const pode = data!.modulos.get(u.id) ?? new Set<Modulo>();
        const de = <T>(c: Modulo) =>
          (linhas ?? [])
            .filter((l) => l.unidade_id === u.id && l.colecao === c)
            .map((l) => ({ ...(l.dados as object), id: l.id }) as T);
        const itens = de<ItemManutencao>("manutencao");
        contagem.set(
          u.id,
          calcularAlertas(
            de<Documento>("documentos"),
            itens.length || !pode.has("manutencao")
              ? itens
              : semente(`${u.id}:manutencao`, manutencaoPadrao),
            de<Rotina>("rotinas"),
          ).length,
        );
      }
      return contagem;
    },
  });
}

// ---------- Dados antigos guardados no navegador ----------

/** Coleções que ficaram no localStorage antes da gestão ir para o banco. */
export function dadosDoNavegador() {
  const achados: { colecao: Modulo; itens: { id: string }[] }[] = [];
  for (const { id } of MODULOS) {
    const raw = lerLocal(`gestao:u1:${id}`) ?? lerLocal(`gestao:${id}`);
    if (!raw) continue;
    try {
      const itens = JSON.parse(raw) as { id: string }[];
      if (Array.isArray(itens) && itens.length) achados.push({ colecao: id, itens });
    } catch {
      // ignora conteúdo inválido
    }
  }
  return achados;
}

export function limparDadosDoNavegador() {
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("gestao:") && k !== CHAVE_UNIDADE_ATUAL && k !== "gestao:ultimo-aviso")
        localStorage.removeItem(k);
  } catch {
    // nada a limpar
  }
}
