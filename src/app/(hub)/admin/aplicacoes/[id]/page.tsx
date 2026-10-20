import type { Metadata } from "next";
import { AppIcon } from "@/components/app-icon";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Notice } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalUuid } from "@/lib/reports/pagination";
import { serverConfig } from "@/lib/server-config";
import { ApplicationForm } from "../form";

export const metadata: Metadata = { title: "Aplicação" };

export default async function EditAppPage({ params, searchParams }: PageProps<"/admin/aplicacoes/[id]">) {
  const { supabase, user } = await requirePage("admin");
  const id = parseOptionalUuid((await params).id);
  const saved = (await searchParams).salvo === "1";
  const [{ data: app }, { data: links }, { data: departments }] = await Promise.all([
    id ? supabase.from("luzia_applications").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    id ? supabase.from("luzia_application_departments").select("department_id").eq("application_id", id) : Promise.resolve({ data: [] }),
    supabase.from("luzia_departments").select("id, name, active").eq("kind", "regular").order("name"),
  ]);
  if (!app) return <ErrorState title="Aplicação não encontrada" action={<ButtonLink href="/admin/aplicacoes">Voltar</ButtonLink>} />;
  const selected = (links ?? []).map((l) => l.department_id);
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader title={app.name} actions={<ButtonLink href="/admin/aplicacoes">Voltar à lista</ButtonLink>} />
      {saved ? (
        <div className="mb-4">
          <Notice tone="success">
            <span role="status">Aplicação salva.</span>
          </Notice>
        </div>
      ) : null}
      {user.adminReadOnly ? (
        <dl className="grid max-w-3xl grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <dt className="text-muted">Ícone</dt>
          <dd>
            <AppIcon icon={app.icon} name={app.name} size="sm" />
          </dd>
          <dt className="text-muted">Descrição</dt>
          <dd>{app.description ?? "—"}</dd>
          <dt className="text-muted">URL</dt>
          <dd className="break-all">{app.url}</dd>
          <dt className="text-muted">Estado</dt>
          <dd>{app.active ? "Ativa" : "Inativa"}</dd>
          <dt className="text-muted">Audiência</dt>
          <dd>{app.audience === "all_departments" ? "Todos os departamentos" : selected.map((d) => deptName.get(d) ?? `#${d}`).join(", ")}</dd>
        </dl>
      ) : (
        <ApplicationForm
          departments={(departments ?? []).filter((d) => d.active || selected.includes(d.id))}
          allowedOrigins={serverConfig().appOrigins}
          app={{
            id: app.id,
            name: app.name,
            description: app.description,
            url: app.url,
            icon: app.icon,
            active: app.active,
            audience: app.audience,
            departmentIds: selected,
          }}
        />
      )}
    </>
  );
}
