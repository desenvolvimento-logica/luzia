# Luz.IA — hub de aplicações (reconstrução)

Portal do Escritório Lógica Contabilidade: login Microsoft corporativo, catálogo de aplicações por departamento, abertura em iframe com o contrato de sessão legado, relatórios hierárquicos e administração auditada.

> Estado: **base local verificada com dados sintéticos.** Nada foi validado contra o Supabase real, o Microsoft Entra ou uma aplicação integrada real. Ver `docs/criterios-de-aceite.md`.

## Requisitos

- Node.js ≥ 20.9 (testado com 24.18), npm.
- Para rodar a interface com login: o projeto Supabase compartilhado com a fundação `luzia_` aplicada (com aprovação, ver `docs/transicao.md`), ou Docker + Supabase CLI para um `supabase start` local (indisponível nesta máquina).
- Para `npm run test:e2e`: Google Chrome instalado.

## Primeiros passos

```bash
npm ci
npm test            # banco (PGlite) + unidade
npm run test:e2e    # postMessage em navegador real, app simulada
npm run verify      # tipos, lint, testes, build e checagem de segredos no bundle
```

A CI (`.github/workflows/verify.yml`) roda o mesmo `npm run verify` em cada PR e em cada push na `main`.

Interface sem login, com dados sintéticos (comparação com `mockups/`):

```bash
# Git Bash
LUZIA_UI_PREVIEW=true npm run dev   # abrir http://localhost:3000/dev/preview/catalogo
npm run screens                      # capturas em test-results/visual/ (desktop e celular, claro e escuro)
# PowerShell
$env:LUZIA_UI_PREVIEW="true"; npm run dev
```

Telas: `catalogo`, `catalogo-vazio`, `catalogo-admin`, `login`, `login-erro`, `relatorios`, `aplicacao`, `admin-aplicacoes`, `admin-aplicacao-editar`. A rota só existe com `LUZIA_UI_PREVIEW=true` e não acessa o banco.

Interface local (precisa de um projeto Supabase com a fundação `luzia_` aplicada):

```bash
cp .env.example .env.local          # PowerShell: Copy-Item .env.example .env.local
# valores no cofre/painel da Vercel; nunca versionar
npm run dev
```

O hub usa o projeto Supabase **compartilhado** (o mesmo do LG e do HelpDesk GC), com tabelas `luzia_`. Não há staging: o caminho de aplicação no projeto real, com aprovação a cada passo, está em `docs/transicao.md`. Em um Supabase local vazio (Docker), a ordem é: `supabase/dev/01_legacy_baseline.sql` → `supabase/dev/02_synthetic_seed.sql` → `supabase/migrations/*.sql` → tenant em `public.luzia_settings` → `select private.luzia_import_legacy();` → (opcional) `supabase/cutover/*.sql`. **Nunca** aplicar `supabase/dev/*` no projeto compartilhado; o `00_supabase_platform_shim.sql` só existe para os testes em PGlite.

Aplicação simulada para testar o iframe localmente:

```bash
# Git Bash
HUB_ORIGIN=http://localhost:3000 PORT=4100 npm run mock-app
# PowerShell
$env:HUB_ORIGIN="http://localhost:3000"; $env:PORT="4100"; npm run mock-app
```

e no `.env.local`: `LUZIA_ALLOW_LOCAL_APPS=true`, `LUZIA_APP_ALLOWED_ORIGINS=http://localhost:4100`.

## Estrutura

```text
src/app/              rotas (login, callback, catálogo, app aberta, novidades, relatórios, admin, API de atividades)
src/components/       interface reutilizável (shell, formulários, estados, gráfico)
src/features/         consultas e Server Actions por domínio
src/lib/auth/         matriz de autorização, sessão, callback
src/lib/sso/          contrato LUZIA_READY / LUZIA_SESSION
src/lib/security/     URLs e origens aprovadas, redirect, upload, ícones
src/lib/activities/   formato normalizado, escopo e adaptadores
src/lib/supabase/     clientes separados: navegador, sessão do servidor, service role
supabase/dev/          shim de teste, legado HIPOTÉTICO, seed sintético do legado (só banco vazio)
supabase/migrations/   fundação luzia_ (tabelas, RLS, RPCs, importação, espelho)
supabase/cutover/      troca para a fase primary
supabase/rollback/     reversões (fundação: só na coexistência; corte)
supabase/verification/ checagem somente leitura após aplicar
supabase/inventory/    inventário somente leitura do banco real
tests/                db (PGlite), unit, e2e (Chrome), fixtures
docs/                 decisões e lacunas, critérios de aceite, operação, transição
```

## Documentos

- `docs/decisoes.md` — inventário, mudança de direção para `luzia_`, decisões técnicas, mudanças de comportamento e dependências externas (X-01…X-14).
- `docs/criterios-de-aceite.md` — AC-01…AC-16 com evidência por nível.
- `docs/transicao.md` — inventário, fundação (coexistência), importação, corte (primary) e reversões, passo a passo.
- `docs/operacao.md` — admissão, mudanças, desligamento, cadastro de app, rotação de segredos, falhas.
