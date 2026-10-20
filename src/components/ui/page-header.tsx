import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</p> : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-text md:text-[32px]">{title}</h1>
        {description ? <p className="mt-1.5 text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
