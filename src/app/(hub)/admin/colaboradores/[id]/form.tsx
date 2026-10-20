"use client";

import { ActionForm } from "@/components/action-form";
import { SelectField } from "@/components/ui/field";
import { updateCollaborator } from "@/features/admin/actions";
import { CARGO_LABEL, CARGOS, type Cargo } from "@/lib/auth/matrix";

interface Props {
  collaborator: { id: number; departmentId: number; role: Cargo; isAdmin: boolean; status: "active" | "inactive" };
  departments: { id: number; name: string; provisioning: boolean }[];
}

export function CollaboratorForm({ collaborator, departments }: Props) {
  return (
    <ActionForm action={updateCollaborator}>
      {(s) => (
        <>
          <input type="hidden" name="id" value={collaborator.id} />
          <SelectField id="department_id" label="Departamento" defaultValue={collaborator.departmentId} required error={s.fieldErrors?.department_id}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.provisioning ? " (sem aplicações)" : ""}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="role"
            label="Cargo"
            defaultValue={collaborator.role}
            error={s.fieldErrors?.role}
            hint="Define o escopo de relatórios. Independe da permissão administrativa."
          >
            {CARGOS.map((c) => (
              <option key={c} value={c}>
                {CARGO_LABEL[c]}
              </option>
            ))}
          </SelectField>
          <SelectField id="access_status" label="Acesso ao hub" defaultValue={collaborator.status} error={s.fieldErrors?.access_status}>
            <option value="active">Ativo</option>
            <option value="inactive">Desativado</option>
          </SelectField>
          <div className="flex items-center gap-2">
            <input id="is_admin" name="is_admin" type="checkbox" defaultChecked={collaborator.isAdmin} className="size-5" />
            <label htmlFor="is_admin" className="text-sm">
              Administrador do hub
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}
