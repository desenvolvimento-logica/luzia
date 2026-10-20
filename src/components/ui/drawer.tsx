"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useCallback, useEffect, useId, useRef } from "react";

const DrawerContext = createContext<(() => void) | null>(null);

/** Fecha o painel atual (com o mesmo aviso de alterações não salvas). */
export function useDrawerClose(): () => void {
  return use(DrawerContext) ?? (() => undefined);
}

/**
 * Painel lateral modal sobre <dialog> nativo: foco contido, Esc fecha, fundo inerte.
 * Ao fechar, navega para `closeHref` e devolve o foco ao elemento `returnFocusId` (o gatilho na lista).
 * `isDirty()` permite avisar antes de descartar alterações.
 */
export function Drawer({
  title,
  closeHref,
  returnFocusId,
  isDirty,
  children,
}: {
  title: string;
  closeHref: string;
  returnFocusId?: string;
  isDirty?: () => boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const close = useCallback(() => {
    if (isDirty?.() && !window.confirm("Descartar as alterações não salvas?")) return;
    ref.current?.close();
    router.replace(closeHref, { scroll: false });
    if (returnFocusId) {
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(returnFocusId)?.focus()));
    }
  }, [closeHref, isDirty, returnFocusId, router]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-none bg-surface p-0 text-text shadow-2xl sm:w-[460px]"
    >
      <DrawerContext value={close}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-5 sm:px-6">
          <h2 id={titleId} className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar painel"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-2"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
      </DrawerContext>
    </dialog>
  );
}

/** Corpo rolável + rodapé fixo do painel; o rodapé nunca cobre os últimos campos. */
export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>;
}

export function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-4 sm:px-6">{children}</div>;
}
