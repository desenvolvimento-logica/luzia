# Registro de decisões e lacunas — reconstrução Luz.IA

Data de início: 19/10/2026. Fontes: `LuzIA-Spec-Reconstrucao.md` (alvo) e `LuzIA-Spec-Operacional.md` (legado, não verificado nesta pasta).

Legenda de evidência usada em todo o projeto:

- **Implementado** — código presente neste repositório.
- **Testado com simulação** — coberto por teste automatizado local (PGlite no lugar do Postgres do Supabase, mocks no lugar de Supabase Auth/Microsoft/apps).
- **Validado em integração real** — exercitado contra Supabase, Microsoft Entra ou aplicação real. **Nada neste repositório está nesse estado ainda.**

## Inventário inicial (Etapa 0)

| Item | Situação |
|---|---|
| Conteúdo da pasta | Só as duas specs. Nenhum código, manifesto, `.env`, dump ou script legado. |
| Código do hub legado | Indisponível (a operacional cita uma cópia em OneDrive de outra máquina). Não inspecionado. |
| Ferramentas | Node 24.18, npm 11.16, git 2.54, Python 3.14, Vercel CLI 64. **Sem Docker, Supabase CLI ou psql.** |
| Controle de versão | `git init` local criado nesta reconstrução. Sem remote, sem deploy. |
| Instruções locais (`AGENTS.md`/`CLAUDE.md`) | Inexistentes na pasta; criado `AGENTS.md` com as regras do projeto. |

## Decisões técnicas

| ID | Decisão | Motivo |
|---|---|---|
| D-01 | Next.js **16.3.8**, React **19.3.0**, TypeScript **6.0.3** estrito. | Versões estáveis com mais de duas semanas em 19/10/2026. TS 7 não é aceito por `typescript-eslint` (peer `<6.1`). Next 16.4.x tinha poucos dias. Documentação lida em `node_modules/next/dist/docs/` (proxy no lugar de middleware, APIs de request assíncronas). |
| D-02 | `@supabase/ssr` 0.12.7 + `@supabase/supabase-js` 2.117.2, chaves `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. | Mantém os nomes da spec. Se o projeto adotar chaves *publishable/secret*, só o valor muda; o nome da variável pública continua sem a chave administrativa. |
| D-03 | ESLint **9.39.5** com `eslint-config-next` 16.3.8. | `eslint-plugin-react` ainda exige ESLint ≤9; o npm marca 9.x como sem suporte. Reavaliar quando o plugin aceitar ESLint 10. |
| D-04 | Tailwind CSS 4.3.3, `lucide-react`, `zod` para validação. | Spec seção 8. |
| D-05 | Banco de testes: **PGlite 0.5.8** (Postgres 18 em WASM) com um *shim* que imita `auth.users`, `auth.identities`, `auth.uid()` e os papéis `anon`/`authenticated`/`service_role`. | Supabase local exige Docker, ausente. Permite testar SQL, RLS (com `set role authenticated` e claims de JWT) e agregados. **Limitações**: conexão única (sem concorrência real), sem PostgREST, sem GoTrue, sem Storage, versão do Postgres possivelmente diferente da produção. |
| D-06 | SQL dividido em três camadas: `supabase/dev/` (shim da plataforma + **reconstrução hipotética** do schema legado, só para banco vazio), `supabase/migrations/` (migração incremental candidata, escrita para rodar sobre o legado) e `supabase/rollback/` + `supabase/cutover/`. | O schema real não foi inspecionado (spec 9). Escrever as extensões como incrementais sobre o legado mantém o caminho de transição honesto. A baseline aborta se encontrar tabelas existentes. |
| D-07 | Provisionamento por RPC `luzia_provision_me()` chamada no callback do hub, com validação de tenant em toda entrada; o gatilho legado em `auth.users` só é removido no corte (`supabase/cutover/`). | Não alterar `auth.users` enquanto o hub antigo e as apps dependem do gatilho legado. |
| D-08 | Auditoria por gatilhos `AFTER` nas tabelas do hub, gravando em `public.admin_audit` na mesma transação. | Atomicidade garantida pelo banco e cobertura também de escritas feitas pelo hub antigo durante a coexistência. |
| D-09 | Matriz hierárquica implementada uma vez no banco (`private.visible_user_ids()`) e espelhada em TypeScript (`src/lib/auth/matrix.ts`) só para interface e validação antecipada; testes verificam que as duas coincidem. | Spec 4 e 8: matriz centralizada, aplicação efetiva no servidor e no RLS. |
| D-10 | Relatórios por funções SQL `security invoker` (o RLS do solicitante continua valendo) com filtro explícito pelo escopo da matriz. Nomes de aplicações vêm de função `security definer` que só expõe id e nome. | Agregados sobre todo o período (P-07), mesma autorização em lista e totais, e logs de apps que o gestor não abre continuam visíveis com o nome. |
| D-11 | Administrador abre qualquer aplicação **ativa**, como no legado (RN-11); aplicação inativa não abre para ninguém. | Spec 4 (proposta sobre inativas) + preservação do legado. |
| D-12 | Self-service de relatórios: o próprio registro fica visível para perfil, mas **não** entra no escopo de relatórios de líder/coordenador (igual à matriz RN-10). | Spec 4: não ampliar escopo. Diferença: o legado incluía o próprio usuário nas *Atividades* porque usava o select de `users` com RLS. |
| D-13 | Adaptadores de atividades Fisco Check e Tributário existem com a infraestrutura de escopo, mas seus mapeamentos de colunas estão **vazios** até confirmar o schema real; respondem "integração ainda não suportada". | Spec 6 e Etapa 4: não inventar tabelas/colunas. |
| D-14 | `openId` gerado a cada renderização do servidor de `/aplicacoes/[id]` e registrado pelo cliente após o início do carregamento. | Remontagem técnica e StrictMode reutilizam o mesmo id (sem duplicar); nova navegação gera novo evento; prefetch de link não registra acesso. |
| D-15 | Iframe com `sandbox` (scripts, same-origin, forms, popups, downloads, modals) **sem** `allow-top-navigation`. | Impede a app de navegar a janela do hub. Pode exigir ajuste se alguma app depender de outra permissão — validar em staging (X-05). |
| D-16 | CSP com `frame-src` = origens aprovadas, `frame-ancestors 'none'`; `script-src` ainda com `'unsafe-inline'`. | Hidratação do Next sem nonce. CSP com nonce via proxy fica como melhoria. A lista de origens é lida no build. |
| D-17 | Teste de navegador com Playwright 1.63 usando o Chrome instalado (`channel: "chrome"`). | Evita download de navegador; cobre o `postMessage` entre três origens reais. |
| D-18 | Conciliação de atividades por e-mail com igualdade exata em minúsculas na consulta à fonte. | Evita carga irrestrita de perfis (spec 6). Perfis gravados com maiúsculas na app não são conciliados — limitação testada, a confirmar no schema real (X-06). |
| D-19 | Sem `Docker`, não foi possível rodar `supabase start`; Storage (upload de ícones) e PostgREST não foram exercitados. | Registrado como X-01. |

## Mudanças de comportamento em relação ao legado (destacar na revisão de transição)

1. "Não atribuído" não recebe nenhuma aplicação, nem as globais (legado: recebia as globais — RN-02).
2. Audiência explícita: `applications.audience` ∈ {`todos`, `selecionados`}; `selecionados` exige ≥1 departamento (restrição adiada no banco). Backfill: app sem vínculos → `todos`. Novas apps criadas pelo hub antigo nascem `selecionados` sem departamentos e o banco rejeita a gravação — **congelar o cadastro de apps no hub antigo durante a coexistência**.
3. Estado de acesso `users.access_status`; desativado não lê dados protegidos, não abre apps, não recebe sessão. O hub antigo não conhece a coluna, mas as novas políticas também valem para ele.
4. Política de `access_log`: inserção exige também acesso à aplicação; administradores deixam de poder alterar/apagar registros de acesso.
5. `anon` perde privilégios nas tabelas do hub; `TRUNCATE`, `TRIGGER` e `REFERENCES` são revogados de `authenticated`.
6. Identidade/e-mail vinculados não podem ser alterados por `UPDATE` comum; só por `admin_change_identity()` com motivo auditado.
7. Remoção/rebaixamento/desativação da última conta administrativa ativa é bloqueada no banco.
8. Política de `users` não inclui mais o próprio desativado nos escopos gerenciais de outros.

## Lacunas e dependências externas concretas

| ID | Dependência | Bloqueia | Quem/onde |
|---|---|---|---|
| X-01 | Projeto Supabase isolado (ou Docker para `supabase start`) com o schema real copiado sem dados pessoais | Teste real de RLS via PostgREST, Auth, Storage, AC-08, AC-16 real | Infraestrutura |
| X-02 | Dump **somente de schema** do banco compartilhado (`pg_dump --schema-only`): tabelas, tipos de coluna, nomes de políticas, funções, gatilhos, grants | Confirmar tipos de id, nomes de índices/políticas, gatilho legado e ajustar a migração candidata | Responsável pelo Supabase |
| X-03 | Tenant ID do Microsoft Entra e confirmação do caminho do `tid` em `auth.identities.identity_data` | Validação de tenant (AC-01) | Admin Microsoft 365 / Supabase Auth |
| X-04 | App registration single-tenant com redirect para o domínio de staging do novo hub; configuração "Allow new users to sign up" (R-02) | Login real | Admin Microsoft 365 / Supabase |
| X-05 | Uma aplicação de referência em staging que aceite a origem do novo hub em `HUB_ORIGIN` | AC-08 real | Desenvolvimento (Lovable) |
| X-06 | Schemas de `comparisons`/`profiles` (Fisco Check) e `acoes`/`mensagens`/`boas_vindas`/`perfis` (Tributário) | Adaptadores de atividades reais (AC-12 real) | Desenvolvimento |
| X-07 | Código do hub legado | Conferir regras não documentadas (ex.: nomes das funções `current_user_*`, bucket) | Responsável |
| X-08 | Backup/PITR confirmado antes de qualquer migração real | Etapa 5 | Infraestrutura |
| X-09 | Política de retenção de acessos/atividades/auditoria e quem pode ler auditoria | Expurgo (não implementado) | Escritório |
| X-11 | Políticas reais do bucket `app-icons` | Admin desativado ainda poderia enviar ícones se as políticas legadas usarem `current_user_is_admin()` (não verifica estado) | Responsável pelo Supabase |
| X-12 | Normalização de e-mail (maiúsculas) nas tabelas de perfil das apps | Atividades de quem tem e-mail com maiúsculas na app | Desenvolvimento |
| X-10 | Aprovação das propostas (Não atribuído, estado de acesso, audiência explícita, última conta admin) | Aplicar a migração em ambiente compartilhado | Dono do produto |
