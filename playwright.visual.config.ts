import { defineConfig } from "@playwright/test";

// Capturas de tela da pré-visualização (dados sintéticos) para comparar com mockups/. Não faz parte do verify.
// Uso: npm run screens  → imagens em test-results/visual/
export default defineConfig({
  testDir: "tests/visual",
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  use: { channel: "chrome", headless: true, baseURL: "http://localhost:4410" },
  webServer: {
    command: "npx next dev -p 4410",
    url: "http://localhost:4410/dev/preview/catalogo",
    timeout: 180_000,
    reuseExistingServer: true,
    env: { LUZIA_UI_PREVIEW: "true", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
