"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Área de conteúdo. Na aplicação aberta não há largura máxima nem margens: o iframe ocupa tudo. */
export function MainArea({ children, pathnameOverride }: { children: ReactNode; pathnameOverride?: string }) {
  const current = usePathname();
  const pathname = pathnameOverride ?? current;
  const fullBleed = pathname.startsWith("/aplicacoes/");
  return (
    <main
      id="conteudo"
      className={fullBleed ? "flex min-h-0 w-full flex-1 flex-col" : "mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8"}
    >
      {children}
    </main>
  );
}
