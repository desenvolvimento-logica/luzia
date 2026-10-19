import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aplicações (admin)" };

export default async function AdminAppsPage() {
  const { supabase } = await requirePage("admin");
  const [{ data: apps }, { data: links }, { data: dptos }] = await Promise.all([
    supabase.from("applications").select("app_id, app_name, app_url, app_icon, app_status, audience").order("app_name"),
    supabase.from("applications_dpto").select("app_id, dpto_id"),
    supabase.from("dpto").select("dpto_id, dpto_name"),
  ]);
  const dptoName = new Map((dptos ?? []).map((d) => [d.dpto_id, d.dpto_name]));

  return (
    <>
      <PageHeader
        title="Aplicações"
        description="Inclui aplicações inativas. Inativas não abrem e não recebem sessão."
        actions={
          <ButtonLink href="/admin/aplicacoes/nova" variant="primary">
            Nova aplicação
          </ButtonLink>
        }
      />
      {!apps?.length ? (
        <EmptyState title="Nenhuma aplicação cadastrada" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {apps.map((a) => {
            const names = (links ?? []).filter((l) => l.app_id === a.app_id).map((l) => dptoName.get(l.dpto_id) ?? `#${l.dpto_id}`);
            return (
              <li key={a.app_id} className="flex items-center gap-4 p-4">
                <AppIcon icon={a.app_icon} name={a.app_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.app_name}
                    {!a.app_status ? <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs">Inativa</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">{a.app_url}</p>
                  <p className="text-xs text-muted">{a.audience === "todos" ? "Todos os departamentos" : `Departamentos: ${names.join(", ")}`}</p>
                </div>
                <Link href={`/admin/aplicacoes/${a.app_id}`} aria-label={`Editar ${a.app_name}`}>
                  Editar
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
