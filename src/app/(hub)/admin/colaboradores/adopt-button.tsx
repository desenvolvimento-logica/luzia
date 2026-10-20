"use client";

import { ActionForm } from "@/components/action-form";
import { adoptLegacyCollaborators } from "@/features/admin/actions";

/** Traz cadastros criados em public.users depois do corte (ex.: pelo gatilho legado de login). Só insere. */
export function AdoptLegacyButton() {
  return (
    <ActionForm action={adoptLegacyCollaborators} submitLabel="Trazer novos cadastros do legado" variant="secondary" className="flex" inline>
      {() => null}
    </ActionForm>
  );
}
