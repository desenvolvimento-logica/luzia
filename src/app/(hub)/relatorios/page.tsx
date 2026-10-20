import type { Metadata } from "next";
import { DailyBars } from "@/components/charts/daily-bars";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Notice } from "@/components/ui/states";
import { loadAccessReport, loadFilterOptions } from "@/features/reports/queries";
import { requirePage } from "@/lib/auth/session";
import { buildQuery, parseOptionalId, parseOptionalUuid, parsePage, parsePageSize } from "@/lib/reports/pagination";
import { formatDateTime, resolvePeriod } from "@/lib/reports/period";
import { ReportFiltersForm } from "./filters";
import { ReportTabs } from "./tabs";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const { supabase } = await requirePage("relatorios");
  const sp = await searchParams;
  const period = resolvePeriod(sp.de, sp.ate);
  const filters = {
    from: period.from,
    to: period.to,
    appId: parseOptionalUuid(sp.app),
    userId: parseOptionalId(sp.colaborador),
    dptoId: parseOptionalId(sp.dpto),
  };
  const page = parsePage(sp.pagina);
  const pageSize = parsePageSize(sp.tamanho);
  const [report, options] = await Promise.all([loadAccessReport(supabase, filters, page, pageSize), loadFilterOptions(supabase)]);
  const { metrics, rows, total } = report;
  const maxTop = Math.max(1, ...metrics.top_applications.map((a) => Number(a.total)));
  const base = {
    de: filters.from,
    ate: filters.to,
    app: filters.appId,
    colaborador: filters.userId,
    dpto: filters.dptoId,
    tamanho: pageSize === 25 ? null : pageSize,
  };

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Relatórios</h1>
      <ReportTabs current="acessos" />
      <ReportFiltersForm period={period} filters={filters} options={options} />
      {period.adjusted ? (
        <div className="mb-4">
          <Notice tone="warning">O período foi ajustado (máximo de 367 dias e data inicial não posterior à final).</Notice>
        </div>
      ) : null}
      <p className="mb-4 text-xs text-muted">
        “Abertura” é a abertura autorizada de uma aplicação pelo hub; não comprova uso dentro da aplicação. Dias no fuso de
        Brasília. A visibilidade segue o departamento e o cargo <em>atuais</em> de cada colaborador.
      </p>

      <section aria-label="Indicadores do período" className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">Total de aberturas</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{Number(metrics.total_opens).toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">Colaboradores distintos com acesso</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{Number(metrics.distinct_collaborators).toLocaleString("pt-BR")}</p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-surface p-4">
          <DailyBars title="Aberturas por dia" data={metrics.daily.map((d) => ({ day: d.day, total: Number(d.total) }))} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Aplicações mais abertas</h2>
          {metrics.top_applications.length === 0 ? (
            <p className="text-sm text-muted">Sem aberturas no período.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {metrics.top_applications.map((a) => (
                <li key={a.application_id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{a.name ?? "Aplicação removida"}</span>
                    <span className="tabular-nums">{Number(a.total).toLocaleString("pt-BR")}</span>
                  </div>
                  <div aria-hidden className="mt-1 h-2 rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-chart" style={{ width: `${(Number(a.total) / maxTop) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section aria-labelledby="lista-acessos">
        <h2 id="lista-acessos" className="mb-3 text-lg font-semibold">
          Aberturas
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma abertura encontrada">Ajuste o período ou os filtros.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Data e hora</th>
                  <th scope="col" className="px-3 py-2 font-medium">Colaborador</th>
                  <th scope="col" className="px-3 py-2 font-medium">Departamento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Aplicação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.event_id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(r.opened_at)}</td>
                    <td className="px-3 py-2">{r.collaborator_name}</td>
                    <td className="px-3 py-2">{r.department_name ?? "—"}</td>
                    <td className="px-3 py-2">{r.application_name ?? "Aplicação removida"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => `/relatorios${buildQuery({ ...base, pagina: p })}`} />
      </section>
    </>
  );
}
