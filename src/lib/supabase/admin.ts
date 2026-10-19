import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "../env";

/**
 * Cliente com service role — ignora RLS. Uso exclusivo dos adaptadores de atividades, sempre depois de
 * resolver o escopo autorizado (src/lib/activities/scope.ts). Retorna null se a chave não estiver configurada.
 */
export function serviceRoleSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const { url } = publicSupabaseEnv();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
