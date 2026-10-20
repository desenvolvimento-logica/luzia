import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aplicações (admin)" };

export default async function AdminAppsPage() {
  const { supabase, user } = await requirePage("admin");
  const [{ data: apps }, { data: links }, { data: departments }] = await Promise.all([
    supabase.from("luzia_applications").select("id, name, url, icon, active, audience").order("name"),
    supabase.from("luzia_application_departments").select("application_id, department_id"),
    supabase.from("luzia_departments").select("id, name"),
  ]);
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title="Aplicações"
        description="Inclui aplicações inativas. Inativas não abrem e não recebem sessão."
        actions={
          user.adminReadOnly ? null : (
            <ButtonLink href="/admin/aplicacoes/nova" variant="primary">
              Nova aplicação
            </ButtonLink>
          )
        }
      />
      {!apps?.length ? (
        <EmptyState title="Nenhuma aplicação cadastrada" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {apps.map((a) => {
            const names = (links ?? []).filter((l) => l.application_id === a.id).map((l) => deptName.get(l.department_id) ?? `#${l.department_id}`);
            return (
              <li key={a.id} className="flex items-center gap-4 p-4">
                <AppIcon icon={a.icon} name={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.name}
                    {!a.active ? <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs">Inativa</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">{a.url}</p>
                  <p className="text-xs text-muted">{a.audience === "all_departments" ? "Todos os departamentos" : `Departamentos: ${names.join(", ")}`}</p>
                </div>
                <Link href={`/admin/aplicacoes/${a.id}`} aria-label={`${user.adminReadOnly ? "Ver" : "Editar"} ${a.name}`}>
                  {user.adminReadOnly ? "Ver" : "Editar"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
