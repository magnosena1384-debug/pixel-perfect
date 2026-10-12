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
}: SelectHTMLAttributes<HTMLSelectElement> & { opcoes: string[] }) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {opcoes.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
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
