// Aplicação integrada SIMULADA: implementa o lado "app" do contrato legado (hub-session-listener.ts da spec
// operacional, seção 7) sem Supabase. Serve para testes de navegador e validação local do iframe.
// Não exibe nem registra tokens: mostra apenas contagem e formato das mensagens recebidas.
//
// Uso manual:  HUB_ORIGIN=http://localhost:3000 PORT=4100 node tests/fixtures/mock-app/server.mjs
// e cadastre http://localhost:4100/ com LUZIA_ALLOW_LOCAL_APPS=true e LUZIA_APP_ALLOWED_ORIGINS=http://localhost:4100.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export function mockAppHtml({ hubOrigin, mode = "app" }) {
  const origin = JSON.stringify(hubOrigin);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>App simulada</title></head>
<body style="font-family:system-ui;padding:1rem">
<h1>${mode === "app" ? "Aplicação simulada" : "Origem não autorizada"}</h1>
<p id="estado">Aguardando sessão do hub…</p>
<script>
  window.__received = [];
  const HUB_ORIGIN = ${origin};
  window.addEventListener("message", (event) => {
    ${mode === "app" ? 'if (event.origin !== HUB_ORIGIN) return;\n    const d = event.data;\n    if (!d || d.type !== "LUZIA_SESSION") return;' : "const d = event.data;"}
    window.__received.push({
      origin: event.origin,
      keys: d && typeof d === "object" ? Object.keys(d).sort() : [],
      // Tokens sintéticos dos testes começam com "sintetico-"; qualquer outro valor é reduzido ao tamanho.
      access: d && typeof d.access_token === "string" ? (d.access_token.startsWith("sintetico-") ? d.access_token : "len:" + d.access_token.length) : null,
    });
    document.getElementById("estado").textContent = "Mensagens de sessão recebidas: " + window.__received.length;
  });
  ${mode === "app" ? "window.parent.postMessage({ type: \"LUZIA_READY\" }, HUB_ORIGIN);" : 'window.parent.postMessage({ type: "LUZIA_READY" }, "*");'}
</script></body></html>`;
}

export function startMockApp({ port, hubOrigin, mode = "app" }) {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(mockAppHtml({ hubOrigin, mode }));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT || 4100);
  const hubOrigin = process.env.HUB_ORIGIN || "http://localhost:3000";
  await startMockApp({ port, hubOrigin });
  console.warn(`App simulada em http://localhost:${port}/ aceitando sessão de ${hubOrigin}`);
}
