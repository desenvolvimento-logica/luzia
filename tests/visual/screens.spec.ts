// Gera capturas da pré-visualização em desktop (1440×1000) e celular (390×844), temas claro e escuro.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SCREENS = (process.env.SCREENS ?? "catalogo,catalogo-vazio,catalogo-admin").split(",");
const OUT = "test-results/visual";
mkdirSync(OUT, { recursive: true });

for (const screen of SCREENS) {
  for (const theme of ["claro", "escuro"] as const) {
    for (const [device, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]] as const) {
      test(`${screen} · ${theme} · ${device}`, async ({ page, context }) => {
        await context.addCookies([{ name: "luzia-tema", value: theme, url: "http://localhost:4410" }]);
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 300));
        });
        page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
        await page.setViewportSize(viewport);
        await page.goto(`/dev/preview/${screen}`);
        await expect(page.locator("main#conteudo")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
        // Sem rolagem horizontal da página (guia: nenhuma tela estoura a largura).
        const overflow = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const extra = document.documentElement.scrollWidth - w;
          const culprits =
            extra > 0
              ? [...document.querySelectorAll("body *")]
                  .filter((el) => el.getBoundingClientRect().right > w + 0.5)
                  .slice(0, 6)
                  .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 50)} → ${Math.round(el.getBoundingClientRect().right)}px`)
              : [];
          return { extra: Math.max(0, extra), culprits };
        });
        expect(overflow, "rolagem horizontal da página").toEqual({ extra: 0, culprits: [] });
        expect(errors, "erros no console").toEqual([]);
        await page.screenshot({ path: `${OUT}/${screen}-${theme}-${device}.png`, fullPage: true });
      });
    }
  }
}
