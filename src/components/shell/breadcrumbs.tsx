"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { type Crumb, defaultCrumbs } from "@/lib/navigation";

interface State {
  path: string;
  crumbs: Crumb[];
}

const BreadcrumbContext = createContext<{ state: State | null; set: (s: State) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<State | null>(null);
  return <BreadcrumbContext value={{ state, set }}>{children}</BreadcrumbContext>;
}

/** Permite a uma página refinar a trilha (ex.: nome da aplicação aberta). */
export function SetBreadcrumb({ items }: { items: Crumb[] }) {
  const ctx = use(BreadcrumbContext);
  const pathname = usePathname();
  const key = JSON.stringify(items);
  useEffect(() => {
    ctx?.set({ path: pathname, crumbs: JSON.parse(key) as Crumb[] });
  }, [ctx, pathname, key]);
  return null;
}

export function Breadcrumbs({ fallback }: { fallback?: Crumb[] }) {
  const ctx = use(BreadcrumbContext);
  const pathname = usePathname();
  const crumbs = ctx?.state?.path === pathname ? ctx.state.crumbs : (fallback ?? defaultCrumbs(pathname));
  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="truncate text-muted no-underline hover:text-text hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={`truncate ${last ? "font-medium text-text" : ""}`} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
