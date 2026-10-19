import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { listCatalog } from "@/features/catalog/queries";
import { requirePage } from "@/lib/auth/session";
import { CatalogGrid } from "./catalog-grid";

export const metadata: Metadata = { title: "Aplicações" };

export default async function CatalogPage() {
  const { user, supabase } = await requirePage();
  const apps = await listCatalog(supabase);
  const pending = user.dptoKind !== "normal";

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={user.dptoName ? `Departamento: ${user.dptoName}` : "Departamento não definido"}
      />
      {pending && !user.isAdmin ? (
        <div className="mb-6">
          <Notice tone="warning">
            Seu cadastro ainda não tem departamento definido, por isso nenhuma aplicação foi liberada. Procure a administração do
            Luz.IA para concluir o cadastro.
          </Notice>
        </div>
      ) : null}
      <CatalogGrid apps={apps} />
    </>
  );
}
