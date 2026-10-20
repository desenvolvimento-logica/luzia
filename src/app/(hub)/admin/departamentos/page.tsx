import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { matchesSearch } from "@/lib/text";
import { DepartmentCreateForm, DepartmentRow } from "./forms";

export const metadata: Metadata = { title: "Departamentos" };

export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/departamentos">) {
  const { supabase, user } = await requirePage("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [{ data: departments }, { data: people }, { data: links }] = await Promise.all([
    supabase.from("luzia_departments").select("id, name, kind, active").order("name"),
    supabase.from("luzia_collaborators").select("department_id, access_status"),
    supabase.from("luzia_application_departments").select("department_id"),
  ]);
  const list = (departments ?? []).filter((d) => matchesSearch(q, d.name));
  const readOnly = user.adminReadOnly;

  return (
    <>
      <PageHeader
        title="Departamentos"
        description="Definem o catálogo de cada colaborador. Não são excluídos (outros sistemas os referenciam): desative os que não forem mais usados."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <form method="get" className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="q" className="text-sm font-medium">
              Buscar
            </label>
            <input id="q" name="q" type="search" defaultValue={q} className="mt-1 min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" />
          </div>
          <button type="submit" className="min-h-10 rounded-md border border-border px-4 text-sm">
            Buscar
          </button>
        </form>
        {readOnly ? null : <DepartmentCreateForm />}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nenhum departamento encontrado" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {list.map((d) => (
            <DepartmentRow
              key={d.id}
              id={d.id}
              name={d.name}
              active={d.active}
              protectedDepartment={d.kind === "provisioning"}
              activePeople={(people ?? []).filter((p) => p.department_id === d.id && p.access_status === "active").length}
              apps={(links ?? []).filter((l) => l.department_id === d.id).length}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </>
  );
}
