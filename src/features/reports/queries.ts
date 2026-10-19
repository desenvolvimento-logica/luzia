import "server-only";
import type { ReportMetrics, ReportPageRow } from "@/lib/supabase/database.types";
import type { HubSupabase } from "@/lib/supabase/server";

export interface ReportFilters {
  from: string;
  to: string;
  appId: number | null;
  userId: number | null;
  dptoId: number | null;
}

export interface AccessReport {
  metrics: ReportMetrics;
  rows: ReportPageRow[];
  total: number;
}

/** Listagem e agregados usam os MESMOS filtros e o mesmo escopo, calculados no banco sobre todo o período. */
export async function loadAccessReport(supabase: HubSupabase, f: ReportFilters, page: number, pageSize: number): Promise<AccessReport> {
  const args = { p_from: f.from, p_to: f.to, p_app_id: f.appId, p_user_id: f.userId, p_dpto_id: f.dptoId };
  const [metrics, list] = await Promise.all([
    supabase.rpc("report_access_metrics", args),
    supabase.rpc("report_access_page", { ...args, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
  ]);
  if (metrics.error || list.error) throw new Error("Falha ao consultar relatório de acessos");
  const rows = list.data ?? [];
  return { metrics: metrics.data, rows, total: rows[0] ? Number(rows[0].total_count) : 0 };
}

export interface FilterOptions {
  users: { id: number; name: string; dptoId: number | null }[];
  apps: { id: number; name: string }[];
  dptos: { id: number; name: string }[];
}

export async function loadFilterOptions(supabase: HubSupabase): Promise<FilterOptions> {
  const [users, apps, dptos] = await Promise.all([
    supabase.rpc("report_scope_users"),
    supabase.rpc("report_app_names"),
    supabase.from("dpto").select("dpto_id, dpto_name").order("dpto_name"),
  ]);
  if (users.error || apps.error || dptos.error) throw new Error("Falha ao carregar filtros");
  return {
    users: (users.data ?? []).map((u) => ({ id: u.user_id, name: u.user_name, dptoId: u.user_dpto })),
    apps: (apps.data ?? []).map((a) => ({ id: a.app_id, name: a.app_name })),
    dptos: (dptos.data ?? []).map((d) => ({ id: d.dpto_id, name: d.dpto_name })),
  };
}
