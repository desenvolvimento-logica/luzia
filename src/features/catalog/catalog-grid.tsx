"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { controlClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Badge, SectionTitle } from "@/components/ui/surface";
import { matchesSearch } from "@/lib/text";
import type { CatalogApp } from "./types";

export function CatalogGrid({ apps, departmentName }: { apps: CatalogApp[]; departmentName: string | null }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => apps.filter((a) => matchesSearch(query, a.name, a.description)), [apps, query]);

  return (
    <section aria-labelledby="catalogo-titulo" className="flex flex-col gap-6">
      <div className="relative">
        <label htmlFor="busca-app" className="sr-only">
          Buscar aplicação por nome ou descrição
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          id="busca-app"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar aplicação..."
          className={`${controlClass} min-h-12 pl-12`}
          disabled={apps.length === 0}
        />
      </div>

      <div>
        <SectionTitle id="catalogo-titulo" count={filtered.length}>
          Suas aplicações
        </SectionTitle>
        <p className="sr-only" aria-live="polite">
          {filtered.length} aplicações encontradas
        </p>
        {apps.length === 0 ? (
          <EmptyState title="Nenhuma aplicação disponível">Quando a administração liberar aplicações para você, elas aparecerão aqui.</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma aplicação encontrada">Tente outro termo de busca.</EmptyState>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            {filtered.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/aplicacoes/${app.id}`}
                  className="group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface text-text no-underline shadow-[0_1px_2px_rgb(16_24_40_/_0.04)] transition-colors hover:border-control"
                >
                  <span className="flex flex-1 items-start gap-4 p-5">
                    <AppIcon icon={app.icon} name={app.name} />
                    <span className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-lg font-semibold leading-snug">{app.name}</span>
                      {app.description ? <span className="line-clamp-2 text-[15px] text-muted">{app.description}</span> : null}
                      {departmentName ? (
                        <span className="mt-1">
                          <Badge tone="brand">{departmentName}</Badge>
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="mx-5 flex min-h-12 items-center gap-2 border-t border-border text-[15px] font-semibold">
                    Abrir aplicação
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
