"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, exact = false, icon, children }: { href: string; exact?: boolean; icon?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href || pathname.startsWith("/aplicacoes") : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-on-chumbo no-underline hover:bg-white/10 ${
        active ? "bg-white/15 font-medium shadow-[inset_0_-2px_0_var(--brand)]" : ""
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
