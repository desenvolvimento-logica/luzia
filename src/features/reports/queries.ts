import "server-only";
import type { ReportMetrics, ReportPageRow, ReportSort, SortDir } from "@/lib/supabase/database.types";
import type { HubSupabase } from "@/lib/supabase/server";

export interface ReportFilters {
  from: string;
  to: string;
  appId: string | null;
  userId: number | null;
  dptoId: number | null;
}

export interface AccessReport {
  metrics: ReportMetrics;
  rows: ReportPageRow[];
  total: number;
}

/** Listagem e agregados usam os MESMOS filtros e o mesmo escopo, calculados no banco sobre todo o período. */
export async function loadAccessReport(
  supabase: HubSupabase,
  f: ReportFilters,
  page: number,
  pageSize: number,
  order: { sort: ReportSort; dir: SortDir } = { sort: "opened_at", dir: "desc" },
): Promise<AccessReport> {
  const args = { p_from: f.from, p_to: f.to, p_application_id: f.appId, p_collaborator_id: f.userId, p_department_id: f.dptoId };
  const [metrics, list] = await Promise.all([
    supabase.rpc("luzia_report_access_metrics", args),
    supabase.rpc("luzia_report_access_page", { ...args, p_limit: pageSize, p_offset: (page - 1) * pageSize, p_sort: order.sort, p_dir: order.dir }),
  ]);
  if (metrics.error || list.error) throw new Error("Falha ao consultar relatório de acessos");
  const rows = list.data ?? [];
  return { metrics: metrics.data, rows, total: rows[0] ? Number(rows[0].total_count) : 0 };
}

export interface FilterOptions {
  users: { id: number; name: string; dptoId: number | null }[];
  apps: { id: string; name: string }[];
  dptos: { id: number; name: string }[];
}

export async function loadFilterOptions(supabase: HubSupabase): Promise<FilterOptions> {
  const [users, apps, dptos] = await Promise.all([
    supabase.rpc("luzia_report_scope"),
    supabase.rpc("luzia_report_application_names"),
    supabase.from("luzia_departments").select("id, name").order("name"),
  ]);
  if (users.error || apps.error || dptos.error) throw new Error("Falha ao carregar filtros");
  return {
    users: (users.data ?? []).map((u) => ({ id: u.collaborator_id, name: u.name, dptoId: u.department_id })),
    apps: (apps.data ?? []).map((a) => ({ id: a.application_id, name: a.name })),
    dptos: (dptos.data ?? []).map((d) => ({ id: d.id, name: d.name })),
  };
}
