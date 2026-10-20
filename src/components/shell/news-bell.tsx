"use client";

import { Bell, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatNewsDate } from "@/lib/reports/period";

export interface BellNewsItem {
  id: string;
  title: string;
  body: string;
  version: string | null;
  publishedAt: string;
}

const iconButton = "inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-text hover:bg-surface-2";

/**
 * Sino com painel flutuante de novidades. Esc ou clique fora fecham e devolvem o foco ao sino.
 * O ponto indica publicação recente (últimos 7 dias); não há controle de leitura por pessoa.
 */
export function NewsBell({ items, recent }: { items: BellNewsItem[]; recent: boolean }) {
  const pathname = usePathname();
  // Aberto "neste caminho": navegar para outra página fecha o painel sem efeito extra.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenAt((prev) => ((typeof value === "function" ? value(prev === pathname) : value) ? pathname : null));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenAt(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`${iconButton} relative`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={recent ? "Novidades — há publicação recente" : "Novidades"}
        title="Novidades"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden className="size-5" />
        {recent ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-surface" /> : null}
      </button>
      {open ? (
        <section
          id={panelId}
          aria-label="Novidades do Luz.IA"
          className="fixed inset-x-2 top-16 z-40 flex max-h-[min(70dvh,36rem)] flex-col rounded-[var(--radius-card)] border border-border bg-surface text-text shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Novidades</h2>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-2"
              aria-label="Fechar novidades"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Nenhuma novidade publicada ainda.</p>
          ) : (
            <ol className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-4">
                  <article>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <time dateTime={n.publishedAt}>{formatNewsDate(n.publishedAt)}</time>
                      {n.version ? <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-text">v{n.version}</span> : null}
                    </p>
                    <h3 className="mt-1 font-semibold leading-snug">{n.title}</h3>
                    {/* Texto puro: nenhum HTML do conteúdo é interpretado. */}
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.body}</p>
                  </article>
                </li>
              ))}
            </ol>
          )}
          <Link
            href="/novidades"
            className="flex min-h-11 items-center justify-center gap-1 border-t border-border px-4 text-sm font-medium text-text no-underline hover:bg-surface-2"
          >
            Ver todas as novidades
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
