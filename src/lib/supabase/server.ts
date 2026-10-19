import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseEnv } from "../env";
import type { Database } from "./database.types";

export type HubSupabase = SupabaseClient<Database>;

/** Cliente da sessão do colaborador no servidor (RLS do próprio colaborador). */
export async function serverSupabase(): Promise<HubSupabase> {
  const { url, anonKey } = publicSupabaseEnv();
  const store = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}
