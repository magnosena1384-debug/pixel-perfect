import { useCallback, useSyncExternalStore } from "react";

// Dados da área de gestão ficam no localStorage enquanto o backend não está disponível.

export type Venda = {
  id: string;
  data: string;
  // Campos opcionais: vendas registradas antes do dashboard não os têm.
  hora?: string;
  unidade?: string;
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

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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

export function agruparVendas(vendas: Venda[], chave: (v: Venda) => string): Grupo[] {
  const grupos = new Map<string, Venda[]>();
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

// ---------- Armazenamento local ----------

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function read<T>(key: string, seed: () => T[]): T[] {
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[];
  try {
    value = raw ? (JSON.parse(raw) as T[]) : seed();
  } catch {
    value = seed();
  }
  cache.set(key, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("gestao:")) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const vazio = () => [];

export function useColecao<T>(nome: string, seed: () => T[] = vazio) {
  const key = `gestao:${nome}`;
  const lista = useSyncExternalStore(
    subscribe,
    () => read<T>(key, seed),
    () => read<T>(key, seed),
  );
  const salvar = useCallback(
    (update: (atual: T[]) => T[]) => {
      const next = update(read<T>(key, seed));
      const raw = JSON.stringify(next);
      try {
        localStorage.setItem(key, raw);
      } catch {
        // Sem armazenamento disponível: mantém só em memória nesta sessão.
      }
      cache.set(key, { raw: readRaw(key), value: next });
      listeners.forEach((l) => l());
    },
    [key, seed],
  );
  return [lista, salvar] as const;
}

export function useAlertas() {
  const [docs] = useColecao<Documento>("documentos");
  const [itens] = useColecao<ItemManutencao>("manutencao", manutencaoPadrao);
  const [rotinas] = useColecao<Rotina>("rotinas");
  return calcularAlertas(docs, itens, rotinas);
}
