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
        await page.setViewportSize(viewport);
        await page.goto(`/dev/preview/${screen}`);
        await expect(page.locator("main#conteudo")).toBeVisible();
        // Sem rolagem horizontal da página (guia: nenhuma tela estoura a largura).
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, "rolagem horizontal").toBeLessThanOrEqual(0);
        await page.screenshot({ path: `${OUT}/${screen}-${theme}-${device}.png`, fullPage: true });
      });
    }
  }
}
