import "server-only";
import type { HubSupabase } from "@/lib/supabase/server";

export interface CatalogApp {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
}

/** Catálogo do colaborador: o RLS devolve somente aplicações que ele pode abrir (admin: todas). */
export async function listCatalog(supabase: HubSupabase): Promise<CatalogApp[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("app_id, app_name, app_description, app_icon")
    .eq("app_status", true)
    .order("app_name");
  if (error) throw new Error("Falha ao carregar o catálogo");
  return (data ?? []).map((a) => ({ id: a.app_id, name: a.app_name, description: a.app_description, icon: a.app_icon }));
}
