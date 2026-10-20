// Datas de relatório: armazenamento em UTC, dias civis em America/Sao_Paulo.
// A conversão de limites é feita no banco (private.report_bounds); aqui só validamos e formatamos.

export const REPORT_TZ = "America/Sao_Paulo";
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 367;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data civil (YYYY-MM-DD) em São Paulo para um instante. */
export function saoPauloDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  return parts; // en-CA já formata como YYYY-MM-DD
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface Period {
  from: string;
  to: string;
  adjusted: boolean;
}

/** Período a partir dos parâmetros; padrão: últimos 30 dias (incluindo hoje) em São Paulo. */
export function resolvePeriod(fromRaw: unknown, toRaw: unknown, now = new Date()): Period {
  const today = saoPauloDate(now);
  const to = typeof toRaw === "string" && isValidIsoDate(toRaw) ? toRaw : today;
  const from = typeof fromRaw === "string" && isValidIsoDate(fromRaw) ? fromRaw : addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) return { from: to, to, adjusted: true };
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) return { from: addDays(to, -(MAX_RANGE_DAYS - 1)), to, adjusted: true };
  return { from, to, adjusted: false };
}

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: REPORT_TZ, dateStyle: "short", timeStyle: "short" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** Formata uma data civil já calculada em São Paulo (sem reconverter fuso). */
export function formatCivilDay(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

const newsDateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: REPORT_TZ, day: "numeric", month: "short", year: "numeric" });

/** "20 out 2026" no fuso de São Paulo. */
export function formatNewsDate(iso: string): string {
  return newsDateFmt.format(new Date(iso)).replace(/\./g, "").replace(/ de /g, " ");
}
