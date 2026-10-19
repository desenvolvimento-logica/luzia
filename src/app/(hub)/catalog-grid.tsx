"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { EmptyState } from "@/components/ui/states";
import type { CatalogApp } from "@/features/catalog/queries";
import { matchesSearch } from "@/lib/text";

export function CatalogGrid({ apps }: { apps: CatalogApp[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => apps.filter((a) => matchesSearch(query, a.name, a.description)), [apps, query]);

  if (apps.length === 0) {
    return <EmptyState title="Nenhuma aplicação disponível">Quando a administração liberar aplicações para você, elas aparecerão aqui.</EmptyState>;
  }

  return (
    <section aria-labelledby="catalogo-titulo">
      <h2 id="catalogo-titulo" className="sr-only">
        Aplicações disponíveis
      </h2>
      <div className="relative mb-4 max-w-md">
        <label htmlFor="busca-app" className="sr-only">
          Buscar aplicação por nome ou descrição
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          id="busca-app"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou descrição"
          className="min-h-10 w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {filtered.length} aplicações encontradas
      </p>
      {filtered.length === 0 ? (
        <EmptyState title="Nenhuma aplicação encontrada">Tente outro termo de busca.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => (
            <li key={app.id}>
              <Link
                href={`/aplicacoes/${app.id}`}
                className="flex h-full items-start gap-4 rounded-lg border border-border bg-surface p-4 text-text no-underline transition-colors hover:border-brand-strong hover:bg-surface-2"
              >
                <AppIcon icon={app.icon} name={app.name} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{app.name}</span>
                  {app.description ? <span className="line-clamp-3 text-sm text-muted">{app.description}</span> : null}
                  <span className="mt-1 text-sm font-medium underline underline-offset-2">Abrir</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
