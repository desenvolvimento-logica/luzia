// AC-14 (parte automatizável): contraste WCAG dos pares de tokens usados na interface, nos dois temas.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(import.meta.dirname, "../../src/app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

// [primeiro plano, fundo, mínimo]: 4.5 texto normal; 3 para contornos de controles, foco e marcas gráficas.
const PAIRS: [string, string, number][] = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-2", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface-2", 4.5],
  ["on-brand", "brand", 4.5],
  ["on-brand", "brand-strong", 4.5],
  ["text", "brand-soft", 4.5],
  ["on-sidebar", "sidebar", 4.5],
  ["on-sidebar-muted", "sidebar", 4.5],
  ["on-sidebar", "sidebar-active", 4.5],
  ["link", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-bg", 4.5],
  ["success", "success-bg", 4.5],
  ["text", "warning-bg", 4.5],
  ["control-border", "surface", 3],
  ["control-border", "bg", 3],
  ["focus", "surface", 3],
  ["focus", "bg", 3],
  ["brand", "sidebar", 3],
  ["chart", "surface", 3],
];

describe.each([
  ["claro", ":root"],
  ["escuro", ":root.dark"],
])("tema %s", (_name, selector) => {
  const t = tokens(selector);
  it.each(PAIRS)("%s sobre %s ≥ %d:1", (fg, bg, min) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it("o tema escuro do sistema repete exatamente os tokens do tema escuro manual", () => {
  expect(tokens(":root:not(.light):not(.dark)")).toEqual(tokens(":root.dark"));
});
