import type { Metadata } from "next";
import { CatalogView } from "@/features/catalog/catalog-view";
import { listCatalog } from "@/features/catalog/queries";
import { requirePage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aplicações" };

export default async function CatalogPage() {
  const { user, supabase } = await requirePage();
  const [apps, { data: news }] = await Promise.all([
    listCatalog(supabase),
    supabase
      .from("luzia_news")
      .select("id, title, body, published_at")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(2),
  ]);

  return (
    <CatalogView
      departmentName={user.dptoName}
      pendingDepartment={user.dptoKind !== "normal"}
      isAdmin={user.isAdmin}
      apps={apps}
      news={(news ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, publishedAt: n.published_at }))}
    />
  );
}
