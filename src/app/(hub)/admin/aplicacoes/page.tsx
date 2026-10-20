import type { Metadata } from "next";
import { AppsAdminView } from "@/features/admin/apps/apps-admin-view";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalUuid } from "@/lib/reports/pagination";
import { serverConfig } from "@/lib/server-config";

export const metadata: Metadata = { title: "Gerenciar aplicações" };

export default async function AdminAppsPage({ searchParams }: PageProps<"/admin/aplicacoes">) {
  const { supabase, user } = await requirePage("admin");
  const sp = await searchParams;
  const [{ data: apps }, { data: links }, { data: departments }] = await Promise.all([
    supabase.from("luzia_applications").select("id, name, description, url, icon, active, audience").order("name"),
    supabase.from("luzia_application_departments").select("application_id, department_id"),
    supabase.from("luzia_departments").select("id, name, kind, active").order("name"),
  ]);
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const savedId = parseOptionalUuid(sp.salvo);

  const rows = (apps ?? []).map((a) => {
    const ids = (links ?? []).filter((l) => l.application_id === a.id).map((l) => l.department_id);
    return {
      id: a.id,
      name: a.name,
      icon: a.icon,
      active: a.active,
      audienceLabel: a.audience === "all_departments" ? "Todos os departamentos" : ids.map((d) => deptName.get(d) ?? `#${d}`).join(", "),
      drawer: {
        id: a.id,
        name: a.name,
        description: a.description,
        url: a.url,
        icon: a.icon,
        active: a.active,
        audience: a.audience,
        departmentIds: ids,
      },
    };
  });

  return (
    <AppsAdminView
      apps={rows}
      departments={(departments ?? []).filter((d) => d.kind === "regular" && d.active).map((d) => ({ id: d.id, name: d.name }))}
      allowedOrigins={serverConfig().appOrigins}
      readOnly={user.adminReadOnly}
      editingId={parseOptionalUuid(sp.editar)}
      creating={sp.nova === "1"}
      savedName={savedId ? (rows.find((r) => r.id === savedId)?.name ?? null) : null}
    />
  );
}
