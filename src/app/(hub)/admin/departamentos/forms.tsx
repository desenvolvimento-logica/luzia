"use client";

import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/ui/field";
import { saveDepartment, setDepartmentActive } from "@/features/admin/actions";

export function DepartmentCreateForm() {
  return (
    <ActionForm action={saveDepartment} submitLabel="Criar departamento" className="flex flex-wrap items-end gap-2">
      {(s) => (
        <div className="flex-1">
          <TextField id="novo-departamento" name="name" label="Novo departamento" required maxLength={80} error={s.fieldErrors?.name} />
        </div>
      )}
    </ActionForm>
  );
}

interface RowProps {
  id: number;
  name: string;
  active: boolean;
  protectedDepartment: boolean;
  activePeople: number;
  apps: number;
  readOnly: boolean;
}

export function DepartmentRow({ id, name, active, protectedDepartment, activePeople, apps, readOnly }: RowProps) {
  const summary = `${activePeople} colaborador(es) ativo(s) · ${apps} aplicação(ões)`;
  if (protectedDepartment || readOnly) {
    return (
      <li className="flex flex-col gap-1 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">
            {name}
            {!active ? <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs">Inativo</span> : null}
          </p>
          {protectedDepartment ? (
            <p className="text-xs text-muted">Departamento de provisionamento — protegido. Não recebe aplicações.</p>
          ) : null}
        </div>
        <p className="text-sm text-muted">{summary}</p>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
      <ActionForm action={saveDepartment} submitLabel="Renomear" variant="secondary" className="flex flex-1 flex-wrap items-end gap-2" inline>
        {(s) => (
          <div className="min-w-48 flex-1">
            <input type="hidden" name="id" value={id} />
            <TextField id={`departamento-${id}`} name="name" label="Nome" defaultValue={name} required maxLength={80} error={s.fieldErrors?.name} />
          </div>
        )}
      </ActionForm>
      <div className="flex items-end gap-4">
        <p className="text-sm text-muted">
          {summary}
          {!active ? " · inativo" : ""}
        </p>
        {active && activePeople > 0 ? null : (
          <ActionForm
            action={setDepartmentActive}
            submitLabel={active ? "Desativar" : "Reativar"}
            variant={active ? "danger" : "secondary"}
            confirm={active ? `Desativar o departamento ${name}?` : undefined}
            className="flex"
            inline
          >
            {() => (
              <>
                <input type="hidden" name="id" value={id} />
                {active ? null : <input type="hidden" name="active" value="true" />}
              </>
            )}
          </ActionForm>
        )}
      </div>
    </li>
  );
}
