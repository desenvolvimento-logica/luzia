import type { Metadata } from "next";
import { CatalogView } from "@/features/catalog/catalog-view";
import { listCatalog } from "@/features/catalog/queries";
import { requirePage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aplicações" };

export default async function CatalogPage() {
  const { user, supabase } = await requirePage();
  const apps = await listCatalog(supabase);
  return <CatalogView departmentName={user.dptoName} pendingDepartment={user.dptoKind !== "normal"} isAdmin={user.isAdmin} apps={apps} />;
}
