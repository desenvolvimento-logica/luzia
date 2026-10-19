import { defineConfig } from "@playwright/test";

// Usa o Chrome instalado na máquina (sem download de navegador).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: { channel: "chrome", headless: true },
});
