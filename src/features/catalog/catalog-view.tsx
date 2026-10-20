import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/ui/states";
import { formatNewsDate } from "@/lib/reports/period";
import { CatalogGrid } from "./catalog-grid";
import type { CatalogApp } from "./types";

export interface CatalogNews {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface CatalogViewProps {
  departmentName: string | null;
  pendingDepartment: boolean;
  isAdmin: boolean;
  apps: CatalogApp[];
  news: CatalogNews[];
}

function summary(body: string) {
  const firstLine = body.split(/\n+/)[0] ?? "";
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
}

export function CatalogView({ departmentName, pendingDepartment, isAdmin, apps, news }: CatalogViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Escritório Lógica</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[32px]">Tudo o que você precisa, em um só lugar.</h1>
          <p className="mt-2 text-base text-muted md:text-lg">
            {isAdmin
              ? "Como administrador, você vê todas as aplicações ativas do hub."
              : "Acesse as ferramentas disponíveis para o seu departamento."}
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-3 self-start rounded-[var(--radius-card)] bg-brand-soft px-4 py-3">
          <Building2 aria-hidden className="size-6" />
          <span className="leading-tight">
            <span className="block text-sm text-muted">Departamento</span>
            <span className="block font-semibold">{departmentName ?? "Não definido"}</span>
          </span>
        </div>
      </div>

      {pendingDepartment && !isAdmin ? (
        <Notice tone="warning">
          Seu cadastro ainda não tem departamento definido, por isso nenhuma aplicação foi liberada. Procure a administração do
          Luz.IA para concluir o cadastro.
        </Notice>
      ) : null}

      <CatalogGrid apps={apps} departmentName={departmentName} />

      <section aria-labelledby="novidades-titulo" className="rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 md:px-6">
          <h2 id="novidades-titulo" className="text-xl font-semibold tracking-tight">
            Novidades
          </h2>
          <Link href="/novidades" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted no-underline hover:text-text">
            Ver todas
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        {news.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted md:px-6">Nenhuma novidade publicada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {news.map((n) => (
              <li key={n.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6 md:px-6">
                <time dateTime={n.publishedAt} className="text-sm text-muted">
                  {formatNewsDate(n.publishedAt)}
                </time>
                <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                  <p className="font-medium">{n.title}</p>
                  <p className="truncate text-sm text-muted">{summary(n.body)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
