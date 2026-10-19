import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { matchesSearch } from "@/lib/text";
import { DptoCreateForm, DptoRow } from "./forms";

export const metadata: Metadata = { title: "Departamentos" };

export default async function DptosPage({ searchParams }: PageProps<"/admin/departamentos">) {
  const { supabase } = await requirePage("admin");
  const q = typeof (await searchParams).q === "string" ? String((await searchParams).q) : "";
  const [{ data: dptos }, { data: users }, { data: links }] = await Promise.all([
    supabase.from("dpto").select("dpto_id, dpto_name, dpto_kind").order("dpto_name"),
    supabase.from("users").select("user_dpto"),
    supabase.from("applications_dpto").select("dpto_id"),
  ]);
  const count = (id: number, rows: { [k: string]: number | null }[] | null, key: string) => (rows ?? []).filter((r) => r[key] === id).length;
  const list = (dptos ?? []).filter((d) => matchesSearch(q, d.dpto_name));

  return (
    <>
      <PageHeader title="Departamentos" description="Departamentos definem o catálogo de cada colaborador." />
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
        <DptoCreateForm />
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nenhum departamento encontrado" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {list.map((d) => (
            <DptoRow
              key={d.dpto_id}
              id={d.dpto_id}
              name={d.dpto_name}
              protectedDpto={d.dpto_kind === "provisionamento"}
              users={count(d.dpto_id, users, "user_dpto")}
              apps={count(d.dpto_id, links, "dpto_id")}
            />
          ))}
        </ul>
      )}
    </>
  );
}
