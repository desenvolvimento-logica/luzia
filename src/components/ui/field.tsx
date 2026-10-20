import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const controlClass =
  "w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 py-2 text-[15px] text-text placeholder:text-muted min-h-11 aria-[invalid=true]:border-danger";

interface FieldShell {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Esconde o rótulo visualmente (continua acessível). */
  hideLabel?: boolean;
}

function Shell({ id, label, hint, error, required, hideLabel, children }: FieldShell & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium"}>
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
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

export function TextField({ id, label, hint, error, hideLabel, name, required, ...props }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <input
        id={id}
        name={name ?? id}
        required={required}
        className={controlClass}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Shell>
  );
}

export function TextArea({ id, label, hint, error, hideLabel, name, required, ...props }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <textarea
        id={id}
        name={name ?? id}
        required={required}
        className={`${controlClass} min-h-28 leading-relaxed`}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  hideLabel,
  children,
  name,
  required,
  ...props
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <select
        id={id}
        name={name ?? id}
        required={required}
        className={controlClass}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </Shell>
  );
}
