"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "../env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

/** Cliente do navegador: só chave pública; autorização efetiva vem do RLS. */
export function browserSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { url, anonKey } = publicSupabaseEnv();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
