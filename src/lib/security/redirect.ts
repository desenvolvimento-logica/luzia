// Redirecionamento pós-login: somente caminhos internos de uma lista permitida.

const ALLOWED_PREFIXES = ["/aplicacoes", "/novidades", "/relatorios", "/admin"] as const;

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || raw.length > 512) return "/";
  // Bloqueia //host, /\host, esquemas e caracteres de controle antes de qualquer interpretação.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f\\]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, "https://hub.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "https://hub.invalid") return "/";
  const path = url.pathname;
  if (path === "/") return "/" + url.search;
  const allowed = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return allowed ? path + url.search : "/";
}
