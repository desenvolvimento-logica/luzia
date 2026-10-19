import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <Inbox aria-hidden className="size-8 text-muted" />
      <p className="font-medium">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Algo deu errado", children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger bg-danger-bg p-8 text-center">
      <AlertTriangle aria-hidden className="size-8 text-danger" />
      <p className="font-medium">{title}</p>
      {children ? <div className="text-sm">{children}</div> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 p-8 text-muted">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success" | "danger"; children: ReactNode }) {
  const tones = {
    info: "border-border bg-surface-2",
    warning: "border-brand-strong bg-warning-bg",
    success: "border-success bg-success-bg",
    danger: "border-danger bg-danger-bg",
  } as const;
  return <div className={`rounded-md border p-3 text-sm ${tones[tone]}`}>{children}</div>;
}
