import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Notice } from "@/components/ui/states";
import { CARGO_LABEL } from "@/lib/auth/matrix";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalId } from "@/lib/reports/pagination";
import { CollaboratorForm } from "./form";

export const metadata: Metadata = { title: "Colaborador" };

export default async function CollaboratorPage({ params }: PageProps<"/admin/colaboradores/[id]">) {
  const { supabase, user: me } = await requirePage("admin");
  const id = parseOptionalId((await params).id);
  const [{ data: person }, { data: departments }] = await Promise.all([
    id ? supabase.from("luzia_collaborators").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("luzia_departments").select("id, name, kind, active").order("name"),
  ]);
  if (!person) return <ErrorState title="Colaborador não encontrado" action={<ButtonLink href="/admin/colaboradores">Voltar</ButtonLink>} />;
  const department = (departments ?? []).find((d) => d.id === person.department_id);

  return (
    <>
      <PageHeader title={person.name} description={person.email} actions={<ButtonLink href="/admin/colaboradores">Voltar à lista</ButtonLink>} />
      <div className="max-w-xl">
        {me.adminReadOnly ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
            <dt className="text-muted">Departamento</dt>
            <dd>{department?.name ?? "—"}</dd>
            <dt className="text-muted">Cargo</dt>
            <dd>{CARGO_LABEL[person.role]}</dd>
            <dt className="text-muted">Administrador</dt>
            <dd>{person.is_admin ? "Sim" : "Não"}</dd>
            <dt className="text-muted">Acesso ao hub</dt>
            <dd>{person.access_status === "active" ? "Ativo" : "Desativado"}</dd>
          </dl>
        ) : (
          <>
            {person.id === me.userId ? (
              <div className="mb-4">
                <Notice tone="warning">Você está editando o próprio cadastro. A última conta administrativa ativa não pode ser removida.</Notice>
              </div>
            ) : null}
            <CollaboratorForm
              collaborator={{ id: person.id, departmentId: person.department_id, role: person.role, isAdmin: person.is_admin, status: person.access_status }}
              departments={(departments ?? [])
                .filter((d) => d.active || d.id === person.department_id)
                .map((d) => ({ id: d.id, name: d.name, provisioning: d.kind === "provisioning" }))}
            />
          </>
        )}
        <p className="mt-6 text-xs text-muted">
          E-mail e identidade Microsoft vinculados não são editáveis aqui; a troca exige o procedimento auditado descrito em
          docs/operacao.md. Departamento, cargo e administração são replicados para o cadastro corporativo usado por outros
          sistemas; o estado de acesso vale só para o Luz.IA. Desativar aqui não encerra sessões já abertas nas aplicações.
        </p>
      </div>
    </>
  );
}
