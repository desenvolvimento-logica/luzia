import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePage } from "@/lib/auth/session";
import { serverConfig } from "@/lib/server-config";
import { ApplicationForm } from "../form";

export const metadata: Metadata = { title: "Nova aplicação" };

export default async function NewAppPage() {
  const { supabase } = await requirePage("admin");
  const { data: dptos } = await supabase.from("dpto").select("dpto_id, dpto_name").eq("dpto_kind", "normal").order("dpto_name");
  return (
    <>
      <PageHeader title="Nova aplicação" actions={<ButtonLink href="/admin/aplicacoes">Voltar à lista</ButtonLink>} />
      <ApplicationForm dptos={(dptos ?? []).map((d) => ({ id: d.dpto_id, name: d.dpto_name }))} allowedOrigins={serverConfig().appOrigins} />
    </>
  );
}
