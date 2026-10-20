export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function parsePage(raw: unknown): number {
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
}

export function parsePageSize(raw: unknown): number {
  const n = typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, n));
}

export function parseOptionalId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,12}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Monta query string preservando filtros (valores vazios são omitidos). */
export function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOptionalUuid(raw: unknown): string | null {
  return typeof raw === "string" && UUID.test(raw) ? raw.toLowerCase() : null;
}

export const REPORT_SORTS = ["opened_at", "collaborator", "department", "application"] as const;
export type ReportSortKey = (typeof REPORT_SORTS)[number];

/** Ordenação do histórico a partir da URL; padrão: data mais recente primeiro. */
export function parseSort(sortRaw: unknown, dirRaw: unknown): { sort: ReportSortKey; dir: "asc" | "desc" } {
  const sort = (REPORT_SORTS as readonly string[]).includes(sortRaw as string) ? (sortRaw as ReportSortKey) : "opened_at";
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : sort === "opened_at" ? "desc" : "asc";
  return { sort, dir };
}
