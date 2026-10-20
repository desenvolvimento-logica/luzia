// Interações acessíveis em navegador real sobre a pré-visualização (dados sintéticos).
import { expect, type Page, test } from "@playwright/test";

/** Abre a página e espera a hidratação (no CI o servidor de desenvolvimento compila sob demanda). */
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test("menu mobile: abre como diálogo, Esc fecha e devolve o foco ao botão", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/dev/preview/catalogo-admin");
  const opener = page.getByRole("button", { name: "Abrir menu" });
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    await opener.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(dialog.getByRole("link", { name: "Gerenciar aplicações" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("menu lateral: recolhe para 64 px e mantém nomes acessíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/dev/preview/catalogo-admin");
  const aside = page.getByRole("complementary", { name: "Menu principal" });
  await expect(async () => {
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect.poll(async () => (await aside.boundingBox())?.width, { timeout: 1_000 }).toBe(64);
  }).toPass({ timeout: 30_000 });
  await expect(aside.getByRole("link", { name: "Relatórios" })).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu" }).click();
  await expect.poll(async () => (await aside.boundingBox())?.width).toBe(224);
});

test("painel de edição: foco no Nome, Esc pede confirmação quando há alteração", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/dev/preview/admin-aplicacao-editar");
  const drawer = page.getByRole("dialog", { name: "Editar aplicação" });
  await expect(drawer).toBeVisible();
  const name = drawer.getByLabel("Nome");
  await expect(name).toBeFocused();
  await name.fill("PERDCOMP 2");

  let prompted = false;
  page.once("dialog", async (d) => {
    prompted = d.message().includes("Descartar");
    await d.dismiss();
  });
  await page.keyboard.press("Escape");
  await expect.poll(() => prompted).toBe(true);
  await expect(drawer).toBeVisible();
  await expect(name).toHaveValue("PERDCOMP 2");

  // Controles com rótulo acessível: opção de audiência e interruptor de status.
  await expect(drawer.getByRole("radio", { name: "Departamentos selecionados" })).toBeChecked();
  await expect(drawer.getByRole("switch", { name: "Aplicação ativa" })).toBeChecked();
});

test("gráfico: setas do teclado percorrem os dias", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/dev/preview/relatorios");
  const chart = page.getByRole("img", { name: /Aberturas por dia/ });
  await chart.focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("status").filter({ hasText: "aberturas em 01/10" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status").filter({ hasText: "aberturas em 02/10" })).toBeVisible();
});
