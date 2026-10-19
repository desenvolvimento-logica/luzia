"use client";

import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/ui/field";
import { deleteDpto, saveDpto } from "@/features/admin/actions";

export function DptoCreateForm() {
  return (
    <ActionForm action={saveDpto} submitLabel="Criar departamento" className="flex flex-wrap items-end gap-2">
      {(s) => (
        <div className="flex-1">
          <TextField id="novo-dpto" name="dpto_name" label="Novo departamento" required maxLength={80} error={s.fieldErrors?.dpto_name} />
        </div>
      )}
    </ActionForm>
  );
}

export function DptoRow({ id, name, protectedDpto, users, apps }: { id: number; name: string; protectedDpto: boolean; users: number; apps: number }) {
  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
      {protectedDpto ? (
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted">Departamento de provisionamento — protegido. Não recebe aplicações.</p>
        </div>
      ) : (
        <ActionForm action={saveDpto} submitLabel="Renomear" variant="secondary" className="flex flex-1 flex-wrap items-end gap-2" inline>
          {(s) => (
            <div className="min-w-48 flex-1">
              <input type="hidden" name="dpto_id" value={id} />
              <TextField id={`dpto-${id}`} name="dpto_name" label="Nome" defaultValue={name} required maxLength={80} error={s.fieldErrors?.dpto_name} />
            </div>
          )}
        </ActionForm>
      )}
      <div className="flex items-end gap-4">
        <p className="text-sm text-muted">
          {users} colaborador(es) · {apps} aplicação(ões)
        </p>
        {!protectedDpto && users === 0 && apps === 0 ? (
          <ActionForm action={deleteDpto} submitLabel="Excluir" variant="danger" confirm={`Excluir o departamento ${name}?`} className="flex" inline>
            {() => <input type="hidden" name="dpto_id" value={id} />}
          </ActionForm>
        ) : null}
      </div>
    </li>
  );
}
