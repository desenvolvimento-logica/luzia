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

// Estado e setter em contextos separados: o setter do useState é estável, então quem só escreve
// (SetBreadcrumb) não re-renderiza nem re-executa efeitos quando a trilha muda.
const BreadcrumbState = createContext<State | null>(null);
const BreadcrumbSetter = createContext<((s: State) => void) | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<State | null>(null);
  return (
    <BreadcrumbSetter value={set}>
      <BreadcrumbState value={state}>{children}</BreadcrumbState>
    </BreadcrumbSetter>
  );
}

/** Permite a uma página refinar a trilha (ex.: nome da aplicação aberta). */
export function SetBreadcrumb({ items }: { items: Crumb[] }) {
  const set = use(BreadcrumbSetter);
  const pathname = usePathname();
  const key = JSON.stringify(items);
  useEffect(() => {
    set?.({ path: pathname, crumbs: JSON.parse(key) as Crumb[] });
  }, [set, pathname, key]);
  return null;
}

export function Breadcrumbs({ fallback }: { fallback?: Crumb[] }) {
  const state = use(BreadcrumbState);
  const pathname = usePathname();
  const crumbs = state?.path === pathname ? state.crumbs : (fallback ?? defaultCrumbs(pathname));
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
