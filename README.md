# Luz.IA — hub de aplicações (reconstrução)

Portal do Escritório Lógica Contabilidade: login Microsoft corporativo, catálogo de aplicações por departamento, abertura em iframe com o contrato de sessão legado, relatórios hierárquicos e administração auditada.

> Estado: **base local verificada com dados sintéticos.** Nada foi validado contra o Supabase real, o Microsoft Entra ou uma aplicação integrada real. Ver `docs/criterios-de-aceite.md`.

## Requisitos

- Node.js ≥ 20.9 (testado com 24.18), npm.
- Para rodar a interface com login: um projeto Supabase **isolado** com o provedor Azure configurado (ou Docker + Supabase CLI para `supabase start`, indisponível nesta máquina).
- Para `npm run test:e2e`: Google Chrome instalado.

## Primeiros passos

```bash
npm ci
npm test            # banco (PGlite) + unidade
npm run test:e2e    # postMessage em navegador real, app simulada
npm run verify      # tipos, lint, testes, build e checagem de segredos no bundle
```

A CI (`.github/workflows/verify.yml`) roda o mesmo `npm run verify` em cada PR e em cada push na `main`.

Interface local (precisa de Supabase isolado):

```bash
cp .env.example .env.local          # PowerShell: Copy-Item .env.example .env.local
# preencher valores do projeto ISOLADO; nunca do projeto compartilhado sem aprovação
npm run dev
```

No Supabase isolado, aplicar nesta ordem (banco vazio): `supabase/dev/01_legacy_baseline.sql` → `supabase/migrations/*.sql` → `supabase/cutover/*.sql` → `supabase/dev/02_synthetic_seed.sql`, e definir o tenant em `private.settings`. **Não** aplicar `supabase/dev/00_supabase_platform_shim.sql` em um projeto Supabase (só existe para os testes em PGlite).

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
supabase/dev/         shim de teste, legado HIPOTÉTICO, seed sintético (só banco vazio)
supabase/migrations/  migração incremental candidata
supabase/rollback/    reversão compatível com os dados
supabase/cutover/     remoção do auto-provisionamento legado (só no corte)
supabase/inventory/   inventário somente leitura do banco real
tests/                db (PGlite), unit, e2e (Chrome), fixtures
docs/                 decisões e lacunas, critérios de aceite, operação, transição
```

## Documentos

- `docs/decisoes.md` — inventário, decisões técnicas, mudanças de comportamento em relação ao legado e dependências externas (X-01…X-12).
- `docs/criterios-de-aceite.md` — AC-01…AC-16 com evidência por nível.
- `docs/transicao.md` — inventário real, ensaio, coexistência, corte e reversão.
- `docs/operacao.md` — admissão, mudanças, desligamento, cadastro de app, rotação de segredos, falhas.
