import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Notice } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalId } from "@/lib/reports/pagination";
import { serverConfig } from "@/lib/server-config";
import { ApplicationForm } from "../form";

export const metadata: Metadata = { title: "Editar aplicação" };

export default async function EditAppPage({ params, searchParams }: PageProps<"/admin/aplicacoes/[id]">) {
  const { supabase } = await requirePage("admin");
  const id = parseOptionalId((await params).id);
  const saved = (await searchParams).salvo === "1";
  const [{ data: app }, { data: links }, { data: dptos }] = await Promise.all([
    id ? supabase.from("applications").select("*").eq("app_id", id).maybeSingle() : Promise.resolve({ data: null }),
    id ? supabase.from("applications_dpto").select("dpto_id").eq("app_id", id) : Promise.resolve({ data: [] }),
    supabase.from("dpto").select("dpto_id, dpto_name").eq("dpto_kind", "normal").order("dpto_name"),
  ]);
  if (!app) return <ErrorState title="Aplicação não encontrada" action={<ButtonLink href="/admin/aplicacoes">Voltar</ButtonLink>} />;

  return (
    <>
      <PageHeader title={app.app_name} actions={<ButtonLink href="/admin/aplicacoes">Voltar à lista</ButtonLink>} />
      {saved ? (
        <div className="mb-4">
          <Notice tone="success">
            <span role="status">Aplicação salva.</span>
          </Notice>
        </div>
      ) : null}
      <ApplicationForm
        dptos={(dptos ?? []).map((d) => ({ id: d.dpto_id, name: d.dpto_name }))}
        allowedOrigins={serverConfig().appOrigins}
        app={{
          id: app.app_id,
          name: app.app_name,
          description: app.app_description,
          url: app.app_url,
          icon: app.app_icon,
          active: app.app_status,
          audience: app.audience,
          dptoIds: (links ?? []).map((l) => l.dpto_id),
        }}
      />
    </>
  );
}
