"use client";

import { type ReactNode, useActionState } from "react";
import type { FormState } from "@/features/admin/schemas";
import { Button } from "./ui/button";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Formulário de Server Action com mensagem acessível e erros por campo via render prop. */
export function ActionForm({
  action,
  children,
  submitLabel = "Salvar",
  variant = "primary",
  confirm,
  className = "flex flex-col gap-4",
  inline = false,
}: {
  action: Action;
  children: (state: FormState) => ReactNode;
  submitLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: null });
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children(state)}
      <div className={inline ? "flex items-center gap-2" : "flex flex-wrap items-center gap-3"}>
        <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
