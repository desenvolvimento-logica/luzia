import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/** Páginas a exibir: primeira, última e vizinhas da atual, com reticências. */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  if (page <= 3) [2, 3, 4].forEach((p) => p <= pages && set.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => p >= 1 && set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const cell = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-control)] px-2 text-sm no-underline";
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
      <p className="text-sm text-muted">
        {from.toLocaleString("pt-BR")}–{to.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}
      </p>
      {pages > 1 ? (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link className={`${cell} text-text hover:bg-surface-2`} href={hrefFor(page - 1)} rel="prev" aria-label="Página anterior">
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={`${cell} text-muted opacity-50`} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>
          {pageWindow(page, pages).map((p, i) => (
            <li key={`${p}-${i}`}>
              {p === "…" ? (
                <span className={`${cell} text-muted`} aria-hidden>
                  …
                </span>
              ) : p === page ? (
                <span className={`${cell} bg-brand font-semibold text-on-brand`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link className={`${cell} text-text hover:bg-surface-2`} href={hrefFor(p)} aria-label={`Página ${p}`}>
                  {p}
                </Link>
              )}
            </li>
          ))}
          <li>
            {page < pages ? (
              <Link className={`${cell} text-text hover:bg-surface-2`} href={hrefFor(page + 1)} rel="next" aria-label="Próxima página">
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={`${cell} text-muted opacity-50`} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
