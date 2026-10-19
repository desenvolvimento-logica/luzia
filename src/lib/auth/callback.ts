// Lógica do callback OAuth isolada do Next para ser testável (tests/unit/auth-callback.test.ts).
import { safeNextPath } from "../security/redirect";

export type LoginErrorCode = "cancelado" | "indisponivel" | "nao_autorizado" | "callback" | "configuracao" | "sessao";

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  cancelado: "O login foi cancelado. Você pode tentar novamente quando quiser.",
  indisponivel: "O login está indisponível no momento. Tente novamente em alguns minutos.",
  nao_autorizado: "Esta conta não está autorizada. Entre com sua conta Microsoft corporativa do escritório.",
  callback: "O retorno do login é inválido ou expirou. Inicie o login novamente.",
  configuracao: "O hub está sem configuração de autenticação neste ambiente.",
  sessao: "Sua sessão terminou. Entre novamente.",
};

export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return (LOGIN_ERROR_MESSAGES as Record<string, string>)[code] ?? LOGIN_ERROR_MESSAGES.callback;
}

/** Erros devolvidos pelo provedor no redirect (RFC 6749 §4.1.2.1). */
export function classifyProviderError(error: string): LoginErrorCode {
  if (error === "access_denied") return "cancelado";
  if (error === "temporarily_unavailable" || error === "server_error") return "indisponivel";
  return "nao_autorizado";
}

const DENY_HINTS = new Set(["luzia_foreign_account", "luzia_identity_conflict", "luzia_no_email"]);

export function classifyProvisionError(err: { hint?: string | null; code?: string | null }): LoginErrorCode {
  if (err.hint && DENY_HINTS.has(err.hint)) return "nao_autorizado";
  if (err.hint === "luzia_tenant_not_configured") return "configuracao";
  return "indisponivel";
}

export interface CallbackDeps {
  exchangeCode(code: string): Promise<{ ok: boolean }>;
  provision(): Promise<{ ok: true } | { ok: false; hint?: string | null; code?: string | null }>;
  signOut(): Promise<void>;
}

/** Retorna o caminho interno para onde redirecionar. Nenhum caminho concede acesso sem provisionamento válido. */
export async function resolveCallback(params: URLSearchParams, deps: CallbackDeps): Promise<string> {
  const providerError = params.get("error");
  if (providerError) return `/login?erro=${classifyProviderError(providerError)}`;

  const code = params.get("code");
  if (!code || code.length > 2048) return "/login?erro=callback";

  let exchanged: { ok: boolean };
  try {
    exchanged = await deps.exchangeCode(code);
  } catch {
    return "/login?erro=indisponivel";
  }
  if (!exchanged.ok) return "/login?erro=callback";

  let provisioned: Awaited<ReturnType<CallbackDeps["provision"]>>;
  try {
    provisioned = await deps.provision();
  } catch {
    provisioned = { ok: false };
  }
  if (!provisioned.ok) {
    await deps.signOut().catch(() => undefined);
    return `/login?erro=${classifyProvisionError(provisioned)}`;
  }
  return safeNextPath(params.get("next"));
}
