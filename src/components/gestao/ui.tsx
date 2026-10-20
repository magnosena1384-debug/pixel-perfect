import type { ReactNode, SelectHTMLAttributes } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { diasAte, formatData, type Situacao } from "@/lib/gestao";

export function Painel({
  titulo,
  acao,
  children,
  className,
}: {
  titulo?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl bg-card p-6", className)}>
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titulo && <h2 className="text-xl font-bold uppercase">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

const SITUACOES_BEM = {
  em_uso: ["Em uso", "bg-primary text-primary-foreground"],
  com_defeito: ["Com defeito", "bg-amber-400 text-black"],
  em_transito: ["Em trânsito", "bg-secondary text-secondary-foreground"],
  baixado: ["Baixado", "bg-muted text-muted-foreground"],
} as const;

/** Pílula com a situação de um bem do patrimônio. */
export function PilulaSituacao({ situacao }: { situacao: keyof typeof SITUACOES_BEM }) {
  const [texto, cor] = SITUACOES_BEM[situacao] ?? SITUACOES_BEM.em_uso;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", cor)}>
      {texto}
    </span>
  );
}

/** Cartão de indicador: rótulo pequeno, número grande e uma linha de detalhe opcional. */
export function Cartao({
  rotulo,
  valor,
  detalhe,
  className = "bg-card",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl p-6", className)}>
      <p className="eyebrow opacity-70">{rotulo}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-1 text-sm opacity-70">{detalhe}</p>}
    </div>
  );
}

/** Tabela simples: primeira coluna em negrito, as outras alinhadas à direita como números. */
export function Tabela({ colunas, linhas }: { colunas: string[]; linhas: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {colunas.map((c, i) => (
              <th key={c} className={cn("py-2 font-medium", i && "pl-3 text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {linhas.map((l, j) => (
            <tr key={j}>
              {l.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "whitespace-nowrap py-2",
                    i ? "pl-3 text-right tabular-nums" : "font-semibold",
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Seletor({
  opcoes,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  /** Texto (valor = rótulo) ou par valor/rótulo quando o que se grava não é o que se lê. */
  opcoes: readonly (string | { valor: string; rotulo: string })[];
}) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {opcoes.map((o) => {
        const { valor, rotulo } = typeof o === "string" ? { valor: o, rotulo: o } : o;
        return (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        );
      })}
    </select>
  );
}

const estilos: Record<Situacao, string> = {
  vencido: "bg-destructive text-destructive-foreground",
  proximo: "bg-amber-400 text-black",
  ok: "bg-primary text-primary-foreground",
  "sem-data": "bg-muted text-muted-foreground",
};

export function SituacaoBadge({
  situacao,
  vencimento,
}: {
  situacao: Situacao;
  vencimento: string | null;
}) {
  let texto = "Sem data";
  if (vencimento) {
    const d = diasAte(vencimento);
    if (d < 0) texto = `Vencido há ${-d} dia${d === -1 ? "" : "s"}`;
    else if (d === 0) texto = "Vence hoje";
    else texto = `${situacao === "ok" ? "Em dia · " : ""}${d} dia${d === 1 ? "" : "s"}`;
  } else if (situacao === "vencido") texto = "Pendente";
  return (
    <span
      title={vencimento ? formatData(vencimento) : undefined}
      className={cn(
        "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
        estilos[situacao],
      )}
    >
      {texto}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
