"use client";

import { ActionForm } from "@/components/action-form";
import { SelectField } from "@/components/ui/field";
import { updateCollaborator } from "@/features/admin/actions";
import { CARGO_LABEL, CARGOS, type Cargo } from "@/lib/auth/matrix";

interface Props {
  user: { id: number; dpto: number | null; role: Cargo; isAdmin: boolean; status: "ativo" | "desativado" };
  dptos: { id: number; name: string; provisioning: boolean }[];
}

export function CollaboratorForm({ user, dptos }: Props) {
  return (
    <ActionForm action={updateCollaborator}>
      {(s) => (
        <>
          <input type="hidden" name="user_id" value={user.id} />
          <SelectField id="user_dpto" label="Departamento" defaultValue={user.dpto ?? ""} required error={s.fieldErrors?.user_dpto}>
            {dptos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.provisioning ? " (sem aplicações)" : ""}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="user_role"
            label="Cargo"
            defaultValue={user.role}
            error={s.fieldErrors?.user_role}
            hint="Define o escopo de relatórios. Independe da permissão administrativa."
          >
            {CARGOS.map((c) => (
              <option key={c} value={c}>
                {CARGO_LABEL[c]}
              </option>
            ))}
          </SelectField>
          <SelectField id="access_status" label="Acesso ao hub" defaultValue={user.status} error={s.fieldErrors?.access_status}>
            <option value="ativo">Ativo</option>
            <option value="desativado">Desativado</option>
          </SelectField>
          <div className="flex items-center gap-2">
            <input id="is_admin" name="is_admin" type="checkbox" defaultChecked={user.isAdmin} className="size-5" />
            <label htmlFor="is_admin" className="text-sm">
              Administrador do hub
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}
