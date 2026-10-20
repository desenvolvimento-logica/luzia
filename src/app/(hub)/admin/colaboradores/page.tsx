import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { CARGO_LABEL, CARGOS, isCargo } from "@/lib/auth/matrix";
import { requirePage } from "@/lib/auth/session";
import { buildQuery, parseOptionalId, parsePage } from "@/lib/reports/pagination";
import { sanitizeSearchTerm } from "@/lib/text";
import { AdoptLegacyButton } from "./adopt-button";

export const metadata: Metadata = { title: "Colaboradores" };
const PAGE_SIZE = 25;

export default async function CollaboratorsPage({ searchParams }: PageProps<"/admin/colaboradores">) {
  const { supabase, user } = await requirePage("admin");
  const sp = await searchParams;
  const q = sanitizeSearchTerm(sp.q);
  const dept = parseOptionalId(sp.dpto);
  const cargo = isCargo(sp.cargo) ? sp.cargo : null;
  const estado = sp.estado === "active" || sp.estado === "inactive" ? sp.estado : null;
  const page = parsePage(sp.pagina);

  let query = supabase
    .from("luzia_collaborators")
    .select("id, name, email, department_id, role, is_admin, access_status, auth_user_id", { count: "exact" })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  if (dept) query = query.eq("department_id", dept);
  if (cargo) query = query.eq("role", cargo);
  if (estado) query = query.eq("access_status", estado);

  const [{ data: people, count }, { data: departments }] = await Promise.all([
    query,
    supabase.from("luzia_departments").select("id, name").order("name"),
  ]);
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const base = { q, dpto: dept, cargo, estado };

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Departamento, cargo, administração e estado de acesso ao hub."
        actions={user.adminReadOnly ? null : <AdoptLegacyButton />}
      />
      <form method="get" className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <TextField id="q" label="Nome ou e-mail" type="search" defaultValue={q} />
        <SelectField id="dpto" label="Departamento" defaultValue={dept ?? ""}>
          <option value="">Todos</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="cargo" label="Cargo" defaultValue={cargo ?? ""}>
          <option value="">Todos</option>
          {CARGOS.map((c) => (
            <option key={c} value={c}>
              {CARGO_LABEL[c]}
            </option>
          ))}
        </SelectField>
        <SelectField id="estado" label="Estado" defaultValue={estado ?? ""}>
          <option value="">Todos</option>
          <option value="active">Ativo</option>
          <option value="inactive">Desativado</option>
        </SelectField>
        <div className="flex items-end">
          <button type="submit" className={buttonClass("primary", "w-full")}>
            Filtrar
          </button>
        </div>
      </form>
      {!people?.length ? (
        <EmptyState title="Nenhum colaborador encontrado" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Nome</th>
                <th scope="col" className="px-3 py-2 font-medium">Departamento</th>
                <th scope="col" className="px-3 py-2 font-medium">Cargo</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">{p.email}</span>
                  </td>
                  <td className="px-3 py-2">{deptName.get(p.department_id) ?? "—"}</td>
                  <td className="px-3 py-2">
                    {CARGO_LABEL[p.role]}
                    {p.is_admin ? <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs">Admin</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    {p.access_status === "active" ? "Ativo" : <span className="text-danger">Desativado</span>}
                    {!p.auth_user_id ? <span className="block text-xs text-muted">Nunca entrou</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/colaboradores/${p.id}`} aria-label={`${user.adminReadOnly ? "Ver" : "Editar"} ${p.name}`}>
                      {user.adminReadOnly ? "Ver" : "Editar"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/colaboradores${buildQuery({ ...base, pagina: p })}`} />
    </>
  );
}
