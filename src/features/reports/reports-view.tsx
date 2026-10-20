import { ArrowDown, ArrowUp, ArrowUpDown, ChartColumn, Package, Users } from "lucide-react";
import Link from "next/link";
import { DailyLine } from "@/components/charts/daily-line";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Notice } from "@/components/ui/states";
import { IconTile } from "@/components/ui/surface";
import { ReportFiltersForm } from "@/app/(hub)/relatorios/filters";
import { ReportTabs } from "@/app/(hub)/relatorios/tabs";
import { buildQuery, type ReportSortKey } from "@/lib/reports/pagination";
import { formatDateTime, type Period } from "@/lib/reports/period";
import type { ReportMetrics, ReportPageRow } from "@/lib/supabase/database.types";
import type { FilterOptions, ReportFilters } from "./queries";

export interface ReportsViewProps {
  period: Period;
  filters: ReportFilters;
  options: FilterOptions;
  metrics: ReportMetrics;
  rows: ReportPageRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: ReportSortKey;
  dir: "asc" | "desc";
}

const COLUMNS: { key: ReportSortKey; label: string }[] = [
  { key: "collaborator", label: "Colaborador" },
  { key: "department", label: "Departamento" },
  { key: "application", label: "Aplicação" },
  { key: "opened_at", label: "Data e hora" },
];

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <IconTile>{icon}</IconTile>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-[28px] font-semibold leading-tight tabular-nums">{value.toLocaleString("pt-BR")}</p>
      </div>
    </div>
  );
}

export function ReportsView({ period, filters, options, metrics, rows, total, page, pageSize, sort, dir }: ReportsViewProps) {
  const base = {
    de: filters.from,
    ate: filters.to,
    app: filters.appId,
    colaborador: filters.userId,
    dpto: filters.dptoId,
    tamanho: pageSize === 25 ? null : pageSize,
  };
  const sortHref = (key: ReportSortKey) => {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "opened_at" ? "desc" : "asc";
    return `/relatorios${buildQuery({ ...base, ordem: key, sentido: nextDir })}`;
  };
  const pageHref = (p: number) => `/relatorios${buildQuery({ ...base, ordem: sort === "opened_at" && dir === "desc" ? null : sort, sentido: sort === "opened_at" && dir === "desc" ? null : dir, pagina: p })}`;
  const maxTop = Math.max(1, ...metrics.top_applications.map((a) => Number(a.total)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]">Relatórios de acesso</h1>
        <p className="mt-1.5 text-base text-muted">Acompanhe como as aplicações são abertas pelo hub.</p>
      </div>
      <ReportTabs current="acessos" />
      <ReportFiltersForm period={period} filters={filters} options={options} />
      {period.adjusted ? <Notice tone="warning">O período foi ajustado (máximo de 367 dias e data inicial não posterior à final).</Notice> : null}

      <section aria-label="Indicadores do período" className="grid gap-4 md:grid-cols-3">
        <Kpi icon={<ChartColumn className="size-6" />} label="Aberturas de aplicações" value={Number(metrics.total_opens)} />
        <Kpi icon={<Users className="size-6" />} label="Colaboradores com acesso" value={Number(metrics.distinct_collaborators)} />
        <Kpi icon={<Package className="size-6" />} label="Aplicações acessadas" value={Number(metrics.distinct_applications ?? 0)} />
      </section>
      <p className="-mt-2 text-xs text-muted">
        “Abertura” é a abertura autorizada de uma aplicação pelo hub; não comprova uso dentro da aplicação. Dias no fuso de
        Brasília. A visibilidade segue o departamento e o cargo <em>atuais</em> de cada colaborador.
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <section aria-labelledby="grafico-titulo" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 md:p-6">
          <h2 id="grafico-titulo" className="mb-3 text-lg font-semibold">
            Aberturas ao longo do período
          </h2>
          <DailyLine title="Aberturas por dia no período" data={metrics.daily.map((d) => ({ day: d.day, total: Number(d.total) }))} />
        </section>
        <section aria-labelledby="ranking-titulo" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 md:p-6">
          <h2 id="ranking-titulo" className="mb-4 text-lg font-semibold">
            Aplicações mais abertas
          </h2>
          {metrics.top_applications.length === 0 ? (
            <p className="text-sm text-muted">Sem aberturas no período.</p>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {metrics.top_applications.map((a) => (
                <li key={a.application_id} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-right">{a.name ?? "Aplicação removida"}</span>
                  <span aria-hidden className="h-2.5 rounded-full bg-surface-2">
                    <span className="block h-2.5 rounded-full bg-chart" style={{ width: `${(Number(a.total) / maxTop) * 100}%` }} />
                  </span>
                  <span className="w-12 text-right tabular-nums">{Number(a.total).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="historico-titulo" className="rounded-[var(--radius-card)] border border-border bg-surface">
        <h2 id="historico-titulo" className="px-5 pb-3 pt-5 text-lg font-semibold md:px-6">
          Histórico de acessos
        </h2>
        {rows.length === 0 ? (
          <div className="px-5 pb-5 md:px-6">
            <EmptyState title="Nenhuma abertura encontrada">Ajuste o período ou os filtros.</EmptyState>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-y border-border bg-surface-2 text-muted">
                <tr>
                  {COLUMNS.map((c) => {
                    const activeCol = sort === c.key;
                    const Icon = activeCol ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={activeCol ? (dir === "asc" ? "ascending" : "descending") : "none"}
                        className="px-5 py-2.5 font-medium md:px-6"
                      >
                        <Link href={sortHref(c.key)} className="inline-flex min-h-8 items-center gap-1.5 text-muted no-underline hover:text-text">
                          {c.label}
                          <Icon aria-hidden className={`size-3.5 ${activeCol ? "text-text" : ""}`} />
                          <span className="sr-only">
                            {activeCol ? `, ordenado ${dir === "asc" ? "crescente" : "decrescente"}` : ", ordenar"}
                          </span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.event_id} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-3 md:px-6">{r.collaborator_name}</td>
                    <td className="px-5 py-3 md:px-6">{r.department_name ?? "—"}</td>
                    <td className="px-5 py-3 md:px-6">{r.application_name ?? "Aplicação removida"}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums md:px-6">{formatDateTime(r.opened_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={pageHref} />
      </section>
    </div>
  );
}
