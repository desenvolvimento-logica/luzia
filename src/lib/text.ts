export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Busca sem acentos e sem diferenciar maiúsculas em qualquer um dos campos. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return fields.some((f) => !!f && normalizeText(f).includes(q));
}

/** Termo seguro para filtros PostgREST (`ilike` dentro de `.or()`): remove curingas e delimitadores. */
export function sanitizeSearchTerm(raw: unknown, max = 60): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[%_*,()\\:"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
