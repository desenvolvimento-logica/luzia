import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePage } from "@/lib/auth/session";
import { serverConfig } from "@/lib/server-config";
import { ApplicationForm } from "../form";

export const metadata: Metadata = { title: "Nova aplicação" };

export default async function NewAppPage() {
  const { supabase, user } = await requirePage("admin");
  if (user.adminReadOnly) redirect("/admin/aplicacoes");
  const { data: departments } = await supabase.from("luzia_departments").select("id, name").eq("kind", "regular").eq("active", true).order("name");
  return (
    <>
      <PageHeader title="Nova aplicação" actions={<ButtonLink href="/admin/aplicacoes">Voltar à lista</ButtonLink>} />
      <ApplicationForm departments={departments ?? []} allowedOrigins={serverConfig().appOrigins} />
    </>
  );
}
