export const THEME_COOKIE = "luzia-tema";
export type ThemePreference = "claro" | "escuro" | "sistema";

export function parseTheme(value: string | undefined | null): ThemePreference {
  return value === "claro" || value === "escuro" ? value : "sistema";
}

export function themeClass(value: string | undefined | null): string {
  const t = parseTheme(value);
  return t === "escuro" ? "dark" : t === "claro" ? "light" : "";
}
