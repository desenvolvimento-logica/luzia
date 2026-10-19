// AC-07 em navegador real (Chrome), com três origens distintas e a aplicação SIMULADA.
// Não usa Supabase nem tokens reais: valida o protocolo postMessage, não a aceitação da sessão por uma app real (AC-08).
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { expect, type Frame, type Page, test } from "@playwright/test";
import ts from "typescript";
import { startMockApp } from "../fixtures/mock-app/server.mjs";

const HUB = "http://127.0.0.1:4401";
const APP = "http://localhost:4402";
const EVIL = "http://localhost:4403";

let servers: Server[] = [];
let authorized = true;

function bridgeJs(): string {
  const src = readFileSync(path.resolve(import.meta.dirname, "../../src/lib/sso/bridge.ts"), "utf8");
  return ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
}

const hubHtml = `<!doctype html><html><body>
<div id="frames"></div>
<script type="module">
  import { createSessionBridge } from "/bridge.js";
  window.__outcomes = [];
  let n = 0;
  const app = document.createElement("iframe");
  const bridge = createSessionBridge({
    targetOrigin: ${JSON.stringify(APP)},
    getFrameWindow: () => app.contentWindow,
    authorize: async () => (await fetch("/authorize")).ok,
    getSession: async () => ({ access_token: "sintetico-at-" + (++n), refresh_token: "sintetico-rt-" + n }),
    onOutcome: (o, t) => window.__outcomes.push(o + ":" + t),
  });
  window.addEventListener("message", (e) => bridge.handleMessage(e));
  app.addEventListener("load", () => bridge.handleLoad());
  app.id = "app"; app.src = ${JSON.stringify(APP + "/")};
  const evil = document.createElement("iframe");
  evil.id = "evil"; evil.src = ${JSON.stringify(EVIL + "/")};
  document.getElementById("frames").append(app, evil);
  window.__navigateApp = (url) => { app.src = url; };
</script></body></html>`;

test.beforeAll(async () => {
  const js = bridgeJs();
  const hub = createServer((req, res) => {
    if (req.url === "/bridge.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(js);
    if (req.url === "/authorize") return res.writeHead(authorized ? 200 : 403).end();
    res.writeHead(200, { "content-type": "text/html" }).end(hubHtml);
  });
  await new Promise<void>((r) => hub.listen(4401, "127.0.0.1", r));
  servers = [hub, await startMockApp({ port: 4402, hubOrigin: HUB }), await startMockApp({ port: 4403, hubOrigin: HUB, mode: "evil" })];
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
});

test.beforeEach(() => {
  authorized = true;
});

const frameAt = (page: Page, origin: string): Frame => {
  const f = page.frames().find((fr) => fr.url().startsWith(origin));
  if (!f) throw new Error(`frame ${origin} ausente`);
  return f;
};
type Received = { origin: string; keys: string[]; access: string | null }[];
const received = (f: Frame) => f.evaluate(() => (window as unknown as { __received: Received }).__received);
const outcomes = (p: Page) => p.evaluate(() => (window as unknown as { __outcomes: string[] }).__outcomes);

test("app autorizada recebe o payload legado; READY de outra origem/janela é ignorado", async ({ page }) => {
  await page.goto(HUB + "/");
  await expect.poll(async () => (await received(frameAt(page, APP))).length).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(300);

  const app = await received(frameAt(page, APP));
  expect(app.length).toBeLessThanOrEqual(2); // load + primeiro READY, no máximo
  for (const m of app) {
    expect(m.origin).toBe(HUB);
    expect(m.keys).toEqual(["access_token", "refresh_token", "type"]);
    expect(m.access).toMatch(/^sintetico-at-\d$/);
  }
  // O iframe malicioso enviou READY com "*" e nada recebeu; nenhuma entrega extra foi disparada por ele.
  expect(await received(frameAt(page, EVIL))).toEqual([]);
  const o = await outcomes(page);
  expect(o.filter((x) => x.endsWith(":ready")).length).toBeLessThanOrEqual(1);
  expect(o.every((x) => x.startsWith("enviada"))).toBe(true);
});

test("autorização revogada no servidor: recarregar não entrega sessão", async ({ page }) => {
  await page.goto(HUB + "/");
  await expect.poll(async () => (await received(frameAt(page, APP))).length).toBeGreaterThanOrEqual(1);
  authorized = false;
  await page.evaluate((u) => (window as unknown as { __navigateApp: (u: string) => void }).__navigateApp(u), APP + "/?recarga=1");
  await expect.poll(async () => (await outcomes(page)).filter((x) => x.startsWith("negada")).length).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(300);
  expect(await received(frameAt(page, APP))).toEqual([]);
});

test("se o iframe navegar para outra origem, o navegador descarta a sessão (targetOrigin explícito)", async ({ page }) => {
  await page.goto(HUB + "/");
  await expect.poll(async () => (await received(frameAt(page, APP))).length).toBeGreaterThanOrEqual(1);
  const before = (await outcomes(page)).length;
  await page.evaluate((u) => (window as unknown as { __navigateApp: (u: string) => void }).__navigateApp(u), EVIL + "/?sequestro=1");
  await expect.poll(async () => (await outcomes(page)).length).toBeGreaterThan(before);
  await page.waitForTimeout(300);
  const hijacked = page.frames().filter((f) => f.url().startsWith(EVIL));
  for (const f of hijacked) expect(await received(f)).toEqual([]);
});
