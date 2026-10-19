import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted min-h-10 aria-[invalid=true]:border-danger";

interface FieldShell {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
}

function Shell({ id, label, hint, error, children }: FieldShell & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({ id, label, hint, error, name, ...props }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input id={id} name={name ?? id} className={control} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...props} />
    </Shell>
  );
}

export function TextArea({ id, label, hint, error, name, ...props }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name ?? id}
        className={`${control} min-h-28`}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Shell>
  );
}

export function SelectField({ id, label, hint, error, children, name, ...props }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select id={id} name={name ?? id} className={control} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...props}>
        {children}
      </select>
    </Shell>
  );
}
