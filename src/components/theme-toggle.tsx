"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { THEME_COOKIE, themeClass, type ThemePreference } from "@/lib/theme";

const ORDER: ThemePreference[] = ["sistema", "claro", "escuro"];
const LABEL: Record<ThemePreference, string> = { sistema: "Tema do sistema", claro: "Tema claro", escuro: "Tema escuro" };

/** `initial` vem do cookie lido no servidor, evitando divergência de hidratação. */
export function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const [theme, setTheme] = useState<ThemePreference>(initial);

  function next() {
    const value = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
    setTheme(value);
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    const cls = themeClass(value);
    if (cls) root.classList.add(cls);
  }

  const Icon = theme === "claro" ? Sun : theme === "escuro" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={next}
      className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-text hover:bg-surface-2"
      aria-label={`${LABEL[theme]}. Alterar tema`}
      title={LABEL[theme]}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
