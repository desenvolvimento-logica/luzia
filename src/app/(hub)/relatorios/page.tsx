import type { Metadata } from "next";
import { loadAccessReport, loadFilterOptions } from "@/features/reports/queries";
import { ReportsView } from "@/features/reports/reports-view";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalId, parseOptionalUuid, parsePage, parsePageSize, parseSort } from "@/lib/reports/pagination";
import { resolvePeriod } from "@/lib/reports/period";

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
  const { sort, dir } = parseSort(sp.ordem, sp.sentido);
  const [report, options] = await Promise.all([
    loadAccessReport(supabase, filters, page, pageSize, { sort, dir }),
    loadFilterOptions(supabase),
  ]);

  return (
    <ReportsView
      period={period}
      filters={filters}
      options={options}
      metrics={report.metrics}
      rows={report.rows}
      total={report.total}
      page={page}
      pageSize={pageSize}
      sort={sort}
      dir={dir}
    />
  );
}
