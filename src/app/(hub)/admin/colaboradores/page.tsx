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

export const metadata: Metadata = { title: "Colaboradores" };
const PAGE_SIZE = 25;

export default async function CollaboratorsPage({ searchParams }: PageProps<"/admin/colaboradores">) {
  const { supabase } = await requirePage("admin");
  const sp = await searchParams;
  const q = sanitizeSearchTerm(sp.q);
  const dpto = parseOptionalId(sp.dpto);
  const cargo = isCargo(sp.cargo) ? sp.cargo : null;
  const estado = sp.estado === "ativo" || sp.estado === "desativado" ? sp.estado : null;
  const page = parsePage(sp.pagina);

  let query = supabase
    .from("users")
    .select("user_id, user_name, user_email, user_dpto, user_role, is_admin, access_status, auth_user_id", { count: "exact" })
    .order("user_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`user_name.ilike.%${q}%,user_email.ilike.%${q}%`);
  if (dpto) query = query.eq("user_dpto", dpto);
  if (cargo) query = query.eq("user_role", cargo);
  if (estado) query = query.eq("access_status", estado);

  const [{ data: users, count }, { data: dptos }] = await Promise.all([query, supabase.from("dpto").select("dpto_id, dpto_name").order("dpto_name")]);
  const dptoName = new Map((dptos ?? []).map((d) => [d.dpto_id, d.dpto_name]));
  const base = { q, dpto, cargo, estado };

  return (
    <>
      <PageHeader title="Colaboradores" description="Departamento, cargo, administração e estado de acesso ao hub." />
      <form method="get" className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <TextField id="q" label="Nome ou e-mail" type="search" defaultValue={q} />
        <SelectField id="dpto" label="Departamento" defaultValue={dpto ?? ""}>
          <option value="">Todos</option>
          {(dptos ?? []).map((d) => (
            <option key={d.dpto_id} value={d.dpto_id}>
              {d.dpto_name}
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
          <option value="ativo">Ativo</option>
          <option value="desativado">Desativado</option>
        </SelectField>
        <div className="flex items-end">
          <button type="submit" className={buttonClass("primary", "w-full")}>
            Filtrar
          </button>
        </div>
      </form>
      {!users?.length ? (
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
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{u.user_name}</span>
                    <span className="block text-xs text-muted">{u.user_email}</span>
                  </td>
                  <td className="px-3 py-2">{u.user_dpto ? dptoName.get(u.user_dpto) ?? "—" : "—"}</td>
                  <td className="px-3 py-2">
                    {CARGO_LABEL[u.user_role]}
                    {u.is_admin ? <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs">Admin</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    {u.access_status === "ativo" ? "Ativo" : <span className="text-danger">Desativado</span>}
                    {!u.auth_user_id ? <span className="block text-xs text-muted">Nunca entrou</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/colaboradores/${u.user_id}`} aria-label={`Editar ${u.user_name}`}>
                      Editar
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
