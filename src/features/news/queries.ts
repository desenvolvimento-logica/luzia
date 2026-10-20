import "server-only";
import type { HubSupabase } from "@/lib/supabase/server";

export const RECENT_NEWS_DAYS = 7;
export const BELL_NEWS_LIMIT = 6;

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  version: string | null;
  publishedAt: string;
}

/**
 * Novidades publicadas para o painel do sino. `recent` indica publicação nos últimos dias
 * (não há controle de leitura por pessoa — spec 5).
 */
export async function bellNews(supabase: HubSupabase, now = new Date()): Promise<{ items: NewsItem[]; recent: boolean }> {
  const { data } = await supabase
    .from("luzia_news")
    .select("id, title, body, version, published_at")
    .lte("published_at", now.toISOString())
    .order("published_at", { ascending: false })
    .limit(BELL_NEWS_LIMIT);
  const items = (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, version: n.version, publishedAt: n.published_at }));
  const since = now.getTime() - RECENT_NEWS_DAYS * 86_400_000;
  return { items, recent: items.some((n) => Date.parse(n.publishedAt) >= since) };
}
