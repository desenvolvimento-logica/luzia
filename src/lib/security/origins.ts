// Origens aprovadas das aplicações integradas. Vêm de configuração confiável (variável de ambiente),
// nunca do formulário de cadastro. Sem dependências: também é importado por next.config.ts.

export interface OriginOptions {
  /** Aceita http://localhost e http://127.0.0.1 (somente desenvolvimento). */
  allowLocal: boolean;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isLocalDevOrigin(url: URL): boolean {
  return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
}

/** Normaliza uma origem configurada; retorna null se não for https (ou local permitido). */
export function normalizeOrigin(raw: string, options: OriginOptions): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;
  if (url.protocol === "https:") return url.origin;
  if (options.allowLocal && isLocalDevOrigin(url)) return url.origin;
  return null;
}

export function parseAllowedOrigins(raw: string | undefined, options: OriginOptions): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    if (!part.trim()) continue;
    const origin = normalizeOrigin(part, options);
    if (origin) out.add(origin);
  }
  return [...out];
}
