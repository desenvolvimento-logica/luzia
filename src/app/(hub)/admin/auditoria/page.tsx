import type { Metadata } from "next";
import { SelectField } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { buildQuery, parsePage } from "@/lib/reports/pagination";
import { formatDateTime } from "@/lib/reports/period";

export const metadata: Metadata = { title: "Auditoria" };
const PAGE_SIZE = 25;
const ENTITIES = { users: "Colaboradores", applications: "Aplicações", applications_dpto: "Audiência", dpto: "Departamentos", patch_notes: "Novidades" } as const;
const ACTIONS: Record<string, string> = { insert: "Criação", update: "Alteração", delete: "Exclusão" };

function describe(changes: Record<string, unknown>): string {
  return Object.entries(changes)
    .map(([k, v]) => {
      if (v && typeof v === "object" && "de" in v && "para" in v) {
        const c = v as { de: unknown; para: unknown };
        return `${k}: ${JSON.stringify(c.de)} → ${JSON.stringify(c.para)}`;
      }
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join("; ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const { supabase } = await requirePage("admin");
  const sp = await searchParams;
  const entity = typeof sp.entidade === "string" && sp.entidade in ENTITIES ? sp.entidade : null;
  const page = parsePage(sp.pagina);
  let q = supabase
    .from("admin_audit")
    .select("audit_id, created_at, actor_user_id, action, entity, entity_id, changes, reason", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) q = q.eq("entity", entity);
  const { data: rows, count } = await q;
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_user_id).filter((v): v is number => v !== null))];
  const { data: actors } = actorIds.length ? await supabase.from("users").select("user_id, user_name").in("user_id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.user_id, a.user_name]));

  return (
    <>
      <PageHeader title="Auditoria administrativa" description="Registros gravados pelo banco na mesma transação de cada alteração. Somente leitura." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <SelectField id="entidade" label="Entidade" defaultValue={entity ?? ""}>
            <option value="">Todas</option>
            {Object.entries(ENTITIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectField>
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>
      {!rows?.length ? (
        <EmptyState title="Nenhum registro" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Quando</th>
                <th scope="col" className="px-3 py-2 font-medium">Ator</th>
                <th scope="col" className="px-3 py-2 font-medium">Ação</th>
                <th scope="col" className="px-3 py-2 font-medium">Entidade</th>
                <th scope="col" className="px-3 py-2 font-medium">Alterações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.audit_id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">{r.actor_user_id ? actorName.get(r.actor_user_id) ?? `#${r.actor_user_id}` : "Sistema"}</td>
                  <td className="px-3 py-2">{ACTIONS[r.action] ?? r.action}</td>
                  <td className="px-3 py-2">
                    {ENTITIES[r.entity as keyof typeof ENTITIES] ?? r.entity} #{r.entity_id}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">
                    {describe(r.changes)}
                    {r.reason ? <span className="mt-1 block font-sans text-muted">Motivo: {r.reason}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/auditoria${buildQuery({ entidade: entity, pagina: p })}`} />
    </>
  );
}
