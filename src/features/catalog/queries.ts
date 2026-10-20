import "server-only";
import type { HubSupabase } from "@/lib/supabase/server";

export interface CatalogApp {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

/** Catálogo do colaborador: o RLS devolve somente aplicações que ele pode abrir (admin: todas). */
export async function listCatalog(supabase: HubSupabase): Promise<CatalogApp[]> {
  const { data, error } = await supabase
    .from("luzia_applications")
    .select("id, name, description, icon")
    .eq("active", true)
    .order("name");
  if (error) throw new Error("Falha ao carregar o catálogo");
  return (data ?? []).map((a) => ({ id: a.id, name: a.name, description: a.description, icon: a.icon }));
}
