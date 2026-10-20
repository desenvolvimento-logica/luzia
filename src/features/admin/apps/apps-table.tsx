"use client";

import { Eye, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { controlClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/surface";
import { matchesSearch } from "@/lib/text";

export interface AdminAppRow {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  audienceLabel: string;
}

export function AppsTable({ apps, readOnly }: { apps: AdminAppRow[]; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | "ativas" | "inativas">("todos");
  const filtered = useMemo(
    () =>
      apps.filter(
        (a) => matchesSearch(query, a.name) && (status === "todos" || (status === "ativas" ? a.active : !a.active)),
      ),
    [apps, query, status],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:max-w-sm sm:flex-1">
          <label htmlFor="busca-apps" className="sr-only">
            Buscar por nome
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input id="busca-apps" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome..." className={`${controlClass} pl-11`} />
        </div>
        <div className="sm:w-56">
          <label htmlFor="filtro-status" className="sr-only">
            Filtrar por status
          </label>
          <select id="filtro-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={controlClass}>
            <option value="todos">Todos os status</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {filtered.length} aplicações listadas
      </p>
      {filtered.length === 0 ? (
        <EmptyState title={apps.length === 0 ? "Nenhuma aplicação cadastrada" : "Nenhuma aplicação encontrada"} />
      ) : (
        <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Aplicação</th>
                <th scope="col" className="px-5 py-3 font-medium">Departamentos</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <AppIcon icon={a.icon} name={a.name} size="sm" />
                      <span className="font-semibold">{a.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{a.audienceLabel}</td>
                  <td className="px-5 py-3">
                    {a.active ? (
                      <Badge tone="success" dot>
                        Ativa
                      </Badge>
                    ) : (
                      <Badge tone="muted" dot>
                        Inativa
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      id={`editar-${a.id}`}
                      href={`/admin/aplicacoes?editar=${a.id}`}
                      scroll={false}
                      aria-label={`${readOnly ? "Ver" : "Editar"} ${a.name}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-sm font-medium text-text no-underline hover:bg-surface-2"
                    >
                      {readOnly ? <Eye aria-hidden className="size-4" /> : <Pencil aria-hidden className="size-4" />}
                      {readOnly ? "Ver" : "Editar"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
