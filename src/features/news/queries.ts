import "server-only";
import type { HubSupabase } from "@/lib/supabase/server";

export const RECENT_NEWS_DAYS = 7;

/** Há novidade publicada nos últimos dias? (Sem controle de leitura por pessoa — spec 5.) */
export async function hasRecentNews(supabase: HubSupabase, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - RECENT_NEWS_DAYS * 86_400_000).toISOString();
  const { count } = await supabase
    .from("luzia_news")
    .select("id", { count: "exact", head: true })
    .gte("published_at", since)
    .lte("published_at", now.toISOString());
  return (count ?? 0) > 0;
}
