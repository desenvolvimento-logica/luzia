// AC-15: garante que a chave administrativa não chega ao bundle do navegador.
// Uso: construir com SUPABASE_SERVICE_ROLE_KEY definido como um valor-canário SINTÉTICO e rodar este script.
//   PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY="luzia-canario-nao-e-segredo"; npm run build; npm run check:bundle
//   Git Bash:   SUPABASE_SERVICE_ROLE_KEY=luzia-canario-nao-e-segredo npm run build && npm run check:bundle
// Nunca rode com a chave real exportada no terminal: o objetivo é provar ausência, não manipular o segredo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", ".next", "static");
const canary = process.env.LUZIA_BUNDLE_CANARY || "luzia-canario-nao-e-segredo";
const forbidden = [canary, "SUPABASE_SERVICE_ROLE_KEY", "serviceRoleSupabase", "service_role"];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(root).filter((f) => /\.(js|mjs|css|json|html|txt)$/.test(f));
} catch {
  console.error("Bundle não encontrado em .next/static. Rode `npm run build` antes.");
  process.exit(2);
}

const hits = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const needle of forbidden) if (content.includes(needle)) hits.push(`${path.relative(root, file)} contém "${needle === canary ? "<canário>" : needle}"`);
}

if (hits.length) {
  console.error("FALHA: referências administrativas no bundle do navegador:\n" + hits.join("\n"));
  process.exit(1);
}
console.warn(`OK: ${files.length} arquivos do navegador verificados; nenhum vestígio da chave administrativa.`);
