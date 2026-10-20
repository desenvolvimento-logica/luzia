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
const ENTITIES = {
  luzia_collaborators: "Colaboradores",
  luzia_applications: "Aplicações",
  luzia_application_departments: "Audiência",
  luzia_departments: "Departamentos",
  luzia_news: "Novidades",
} as const;
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
    .from("luzia_audit_events")
    .select("id, created_at, actor_collaborator_id, action, entity, entity_id, changes, reason", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) q = q.eq("entity", entity);
  const { data: rows, count } = await q;
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_collaborator_id).filter((v): v is number => v !== null))];
  const { data: actors } = actorIds.length ? await supabase.from("luzia_collaborators").select("id, name").in("id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.name]));

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
        <section aria-label="Registros de auditoria" className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Quando</th>
                  <th scope="col" className="px-5 py-3 font-medium">Ator</th>
                  <th scope="col" className="px-5 py-3 font-medium">Ação</th>
                  <th scope="col" className="px-5 py-3 font-medium">Entidade</th>
                  <th scope="col" className="px-5 py-3 font-medium">Alterações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border align-top last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3">{formatDateTime(r.created_at)}</td>
                    <td className="px-5 py-3">{r.actor_collaborator_id ? actorName.get(r.actor_collaborator_id) ?? `#${r.actor_collaborator_id}` : r.reason === "importacao-legado" ? "Importação do legado" : "Sistema"}</td>
                    <td className="px-5 py-3">{ACTIONS[r.action] ?? r.action}</td>
                    <td className="px-5 py-3">
                      {ENTITIES[r.entity as keyof typeof ENTITIES] ?? r.entity} #{r.entity_id}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs break-all">
                      {describe(r.changes)}
                      {r.reason ? <span className="mt-1 block font-sans text-muted">Motivo: {r.reason}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/auditoria${buildQuery({ entidade: entity, pagina: p })}`} />
        </section>
      )}
    </>
  );
}
