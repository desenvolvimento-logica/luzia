import { isLocalDevOrigin, type OriginOptions } from "./origins";

export type AppUrlCheck =
  | { ok: true; url: string; origin: string }
  | { ok: false; reason: AppUrlRejection };

export type AppUrlRejection = "invalida" | "esquema" | "credenciais" | "origem_nao_aprovada";

export const APP_URL_MESSAGES: Record<AppUrlRejection, string> = {
  invalida: "Informe uma URL completa e válida.",
  esquema: "A URL precisa usar HTTPS.",
  credenciais: "A URL não pode conter usuário ou senha.",
  origem_nao_aprovada: "A origem desta URL não está na lista de origens aprovadas do hub.",
};

/**
 * Valida a URL de uma aplicação integrada. A origem resultante é o targetOrigin da entrega de sessão,
 * então só origens aprovadas em configuração são aceitas.
 */
export function checkAppUrl(raw: string, allowedOrigins: readonly string[], options: OriginOptions): AppUrlCheck {
  const value = raw.trim();
  if (!value || /[\s<>"']/.test(value)) return { ok: false, reason: "invalida" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalida" };
  }
  const local = options.allowLocal && isLocalDevOrigin(url);
  if (url.protocol !== "https:" && !local) return { ok: false, reason: "esquema" };
  if (url.username || url.password) return { ok: false, reason: "credenciais" };
  if (!allowedOrigins.includes(url.origin)) return { ok: false, reason: "origem_nao_aprovada" };
  return { ok: true, url: url.toString(), origin: url.origin };
}
