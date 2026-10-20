import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-[var(--radius-card)] border border-border bg-surface ${className}`} {...props} />;
}

export function SectionTitle({ children, count, actions, id }: { children: ReactNode; count?: number; actions?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
        {children}
        {count !== undefined ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium text-muted">
            {count}
          </span>
        ) : null}
      </h2>
      {actions}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "muted" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text",
  brand: "bg-brand-soft text-text",
  success: "bg-success-bg text-success",
  muted: "bg-surface-2 text-muted",
  danger: "bg-danger-bg text-danger",
};

/** Selo textual; a cor nunca é a única informação. */
export function Badge({ tone = "neutral", dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Quadrado de ícone (indicadores, cards). */
export function IconTile({ children, className = "size-12" }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-text ${className}`}>
      {children}
    </span>
  );
}
