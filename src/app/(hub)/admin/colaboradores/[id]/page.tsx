import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Notice } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalId } from "@/lib/reports/pagination";
import { CollaboratorForm } from "./form";

export const metadata: Metadata = { title: "Editar colaborador" };

export default async function EditCollaboratorPage({ params }: PageProps<"/admin/colaboradores/[id]">) {
  const { supabase, user: me } = await requirePage("admin");
  const id = parseOptionalId((await params).id);
  const [{ data: u }, { data: dptos }] = await Promise.all([
    id ? supabase.from("users").select("*").eq("user_id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("dpto").select("dpto_id, dpto_name, dpto_kind").order("dpto_name"),
  ]);
  if (!u) return <ErrorState title="Colaborador não encontrado" action={<ButtonLink href="/admin/colaboradores">Voltar</ButtonLink>} />;

  return (
    <>
      <PageHeader title={u.user_name} description={u.user_email} actions={<ButtonLink href="/admin/colaboradores">Voltar à lista</ButtonLink>} />
      <div className="max-w-xl">
        {u.user_id === me.userId ? (
          <div className="mb-4">
            <Notice tone="warning">Você está editando o próprio cadastro. A última conta administrativa ativa não pode ser removida.</Notice>
          </div>
        ) : null}
        <CollaboratorForm
          user={{ id: u.user_id, dpto: u.user_dpto, role: u.user_role, isAdmin: u.is_admin, status: u.access_status }}
          dptos={(dptos ?? []).map((d) => ({ id: d.dpto_id, name: d.dpto_name, provisioning: d.dpto_kind === "provisionamento" }))}
        />
        <p className="mt-6 text-xs text-muted">
          E-mail e identidade Microsoft vinculados não são editáveis aqui. A troca exige o procedimento auditado descrito em
          docs/operacao.md. Desativar no hub não encerra sessões já abertas nas aplicações nem credenciais locais delas.
        </p>
      </div>
    </>
  );
}
