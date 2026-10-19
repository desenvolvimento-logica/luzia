"use server";

import { z } from "zod";
import { AuthorizationError, requireAction } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { checkAppUrl } from "@/lib/security/app-url";
import { serverConfig } from "@/lib/server-config";

const appIdSchema = z.number().int().positive();
const openIdSchema = z.uuid();

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Registra a abertura autorizada. Idempotente por openId: remontagens e reenvios não duplicam. */
export async function registerOpen(appId: number, openId: string): Promise<ActionResult> {
  const parsed = z.object({ appId: appIdSchema, openId: openIdSchema }).safeParse({ appId, openId });
  if (!parsed.success) return { ok: false, message: "Parâmetros inválidos." };
  try {
    const { supabase } = await requireAction();
    const { error } = await supabase.rpc("luzia_register_open", { p_app_id: parsed.data.appId, p_open_id: parsed.data.openId });
    return error ? { ok: false, message: dbErrorMessage(error, "Acesso não autorizado.") } : { ok: true };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, message: "Seu acesso não está ativo." };
    return { ok: false, message: "Não foi possível registrar a abertura." };
  }
}

/**
 * Revalida, antes de CADA entrega de sessão, que o colaborador segue ativo, que a aplicação segue ativa e
 * autorizada e que a origem cadastrada ainda está aprovada. Não devolve tokens.
 */
export async function authorizeSessionDelivery(appId: number): Promise<{ ok: true; origin: string } | { ok: false }> {
  const parsed = appIdSchema.safeParse(appId);
  if (!parsed.success) return { ok: false };
  try {
    const { supabase } = await requireAction();
    const [{ data: can }, { data: app }] = await Promise.all([
      supabase.rpc("luzia_can_open", { p_app_id: parsed.data }),
      supabase.from("applications").select("app_url, app_status").eq("app_id", parsed.data).maybeSingle(),
    ]);
    if (can !== true || !app?.app_status) return { ok: false };
    const cfg = serverConfig();
    const check = checkAppUrl(app.app_url, cfg.appOrigins, { allowLocal: cfg.allowLocalApps });
    return check.ok ? { ok: true, origin: check.origin } : { ok: false };
  } catch {
    return { ok: false };
  }
}

const issueSchema = z.enum(["sem_ready", "falha_carregamento"]);

/** Registra incompatibilidade de iframe para a equipe corrigir a integração (sem dados de sessão). */
export async function reportFrameIssue(appId: number, kind: string): Promise<void> {
  const a = appIdSchema.safeParse(appId);
  const k = issueSchema.safeParse(kind);
  if (!a.success || !k.success) return;
  try {
    const { user } = await requireAction();
    console.warn(JSON.stringify({ evento: "luzia_iframe_incompativel", app_id: a.data, tipo: k.data, user_id: user.userId, em: new Date().toISOString() }));
  } catch {
    /* sem sessão: ignorar */
  }
}
