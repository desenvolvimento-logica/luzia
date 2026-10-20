# Registro de decisões e lacunas — reconstrução Luz.IA

Data de início: 19/10/2026. Fontes: `LuzIA-Spec-Reconstrucao.md` (alvo) e `LuzIA-Spec-Operacional.md` (legado, não verificado nesta pasta).

Legenda de evidência usada em todo o projeto:

- **Implementado** — código presente neste repositório.
- **Testado com simulação** — coberto por teste automatizado local (PGlite no lugar do Postgres do Supabase, mocks no lugar de Supabase Auth/Microsoft/apps).
- **Validado em integração real** — exercitado contra Supabase, Microsoft Entra ou aplicação real. **Nada neste repositório está nesse estado ainda.**

## Mudança de direção em 20/10/2026

O hub usa o **mesmo projeto Supabase** do Controle de Vencimentos LG (`legal_`) e do HelpDesk GC (`gestao_cadastros_`), que também é a produção do hub antigo e das apps. Decisões do dono do produto:

1. Prefixo **`luzia_`** para tabelas, tipos e funções (`public.luzia_*`, `private.luzia_*`).
2. As tabelas `luzia_` passam a ser a **fonte da verdade** depois do corte, com os **mesmos IDs** do legado; departamentos e colaboradores são **espelhados** para `public.dpto`/`public.users`, porque o HelpDesk GC (FKs `on delete cascade` para `public.dpto` e `restrict` para `public.users`) e o `lic_` (`lic_profiles.corporate_user_id`) dependem delas.
3. Migrar **somente cadastros** (departamentos, colaboradores, aplicações e audiências). Histórico de acessos (`access_log`) e novidades (`patch_notes`) ficam só no legado; ícones continuam como URL no cadastro (sem copiar arquivos).

A migração anterior (que alterava políticas, colunas e gatilhos das tabelas legadas) foi descartada antes de ser aplicada em qualquer banco: violaria as regras do projeto compartilhado documentadas pelos outros sistemas (não alterar `auth.users`, `public.users`, `public.dpto`, nem os privilégios do schema `private`).

## Inventário do projeto real (somente leitura, 20/10/2026)

Executado pelo usuário no SQL Editor (`supabase/inventory/inventario-somente-leitura.sql`); o resultado não contém dados pessoais.

| Ponto | Resultado | Efeito |
|---|---|---|
| Objetos `luzia_` existentes | nenhum | sem colisão de nomes |
| Schema `private` | existe, dono `postgres`, `authenticated` com USAGE | pré-condição da migração atendida |
| Postgres | 17.6 (testes locais em PGlite 18) | migração não usa recursos exclusivos da 18 |
| `public.users` | colunas `user_id bigint`, `auth_user_id uuid` (unique, FK sem ação para `auth.users`), `user_name`/`user_email` varchar, `user_dpto bigint not null`, `user_role` varchar com check dos 5 cargos, `is_admin`, `dt_create`, `user_create`; `user_email` unique | espelho compatível; reconstrução do legado em `supabase/dev/01_legacy_baseline.sql` alinhada |
| `public.dpto` | `dpto_id bigint`, `dpto_name` varchar unique, `dt_create`, `user_create` | espelho compatível |
| IDs identity | `user_id` e `dpto_id` são `GENERATED ALWAYS AS IDENTITY` (consulta complementar, 20/10/2026) | o espelho cria linhas legadas sem informar id e usa o id gerado; nenhuma escrita com id explícito no legado |
| Gatilhos | `on_auth_user_created` (hub), `on_auth_user_created_cc` (contcheck) em `auth.users`; `on_app_user_created` AFTER INSERT em `public.users` | hub novo não altera nenhum |
| Identidades | 68 `azure`, **8 `email`** (R-02 confirmado: há contas por e-mail/senha no projeto); `tid` em `custom_claims.tid`; 1 tenant | caminho do `tid` da RPC confirmado; sessão por e-mail é negada pelo hub novo |
| Contagens | 17 departamentos, 133 colaboradores (57 nunca entraram), 1 admin, 8 aplicações (7 ativas, todas com vínculos), 25 vínculos, 678 acessos, 3 novidades; 0 e-mails com maiúsculas ou repetidos | importação não deve abortar; todas as apps viram `selected_departments` |
| FKs de outros sistemas | 14, todas do HelpDesk GC (`gestao_cadastros_requester_departments` → `dpto` **cascade**; demais → `users` restrict/cascade/set null). `lic_profiles` não tem FK formal | espelho nunca apaga (D-22) |
| Origens de `app_url` | `https://contcheck.lovable.app`, `https://cpa-tax-planner.lovable.app`, `https://fiscocheck.lovable.app`, `https://limite-certo.lovable.app`, `https://perdcomp-pilot.lovable.app`, `https://tax-hub-central.lovable.app` (3 apps) | valor de `LUZIA_APP_ALLOWED_ORIGINS`; `limite-certo` não consta da spec operacional |
| Bucket `app-icons` | público; insert/update/delete só com `current_user_is_admin()` | upload pelo hub novo depende do `is_admin` legado (mantido pelo espelho) |

### Achados sobre o hub antigo (não alterados por este projeto)

- **F-01 — catálogo sem restrição por departamento.** `applications_select_scoped` usa `not exists (select … from applications_dpto …)`, mas `applications_dpto_select_admin` só deixa admin ler `applications_dpto`. Para não-admins a subconsulta não vê vínculo nenhum e toda aplicação ativa aparece. Reproduzido em `tests/db/legacy-behavior.test.ts` com as políticas reais; **a confirmar com um login não-admin no hub antigo**. Consequência para o corte: hoje as pessoas veem as 7 aplicações ativas; no hub novo cada uma verá só as liberadas para o seu departamento (25 vínculos). Revisar os vínculos antes do corte.
- **F-02 — `anon` com todos os privilégios** (inclusive `TRUNCATE`) nas tabelas legadas do hub. O RLS limita leitura/escrita via API, e o PostgREST não expõe `TRUNCATE`, mas é endurecimento pendente do legado (não alterado: tabelas compartilhadas).
- **F-03 — `access_log` apaga em cascata** com o colaborador ou a aplicação legada. O espelho do hub novo nunca apaga linhas legadas.

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
| D-02 | `@supabase/ssr` 0.12.7 + `@supabase/supabase-js` 2.117.2. Variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` (servidor). | Mesmos nomes dos outros projetos no Supabase compartilhado (LG e HelpDesk GC), decidido em 20/10/2026. A chave secreta nunca recebe prefixo público. |
| D-03 | ESLint **9.39.5** com `eslint-config-next` 16.3.8. | `eslint-plugin-react` ainda exige ESLint ≤9; o npm marca 9.x como sem suporte. Reavaliar quando o plugin aceitar ESLint 10. |
| D-04 | Tailwind CSS 4.3.3, `lucide-react`, `zod` para validação. | Spec seção 8. |
| D-05 | Banco de testes: **PGlite 0.5.8** (Postgres 18 em WASM) com um *shim* que imita `auth.users`, `auth.identities`, `auth.uid()` e os papéis `anon`/`authenticated`/`service_role`. | Supabase local exige Docker, ausente. Permite testar SQL, RLS (com `set role authenticated` e claims de JWT) e agregados. **Limitações**: conexão única (sem concorrência real), sem PostgREST, sem GoTrue, sem Storage, versão do Postgres possivelmente diferente da produção. |
| D-06 | SQL em camadas: `supabase/dev/` (shim da plataforma + **reconstrução hipotética** do legado + seed sintético do legado, só para banco vazio), `supabase/migrations/` (fundação `luzia_`), `supabase/cutover/` (troca de fase), `supabase/rollback/` (reversões), `supabase/verification/` (checagem somente leitura) e `supabase/inventory/`. Aplicação manual no SQL Editor, nunca `supabase db push`. | Mesmo processo do LG e do GC no projeto compartilhado. A baseline e o seed abortam se encontrarem dados. |
| D-07 | Provisionamento por RPC `luzia_provision_me()` no callback: exige sessão Microsoft (`amr` oauth + provedor `azure`, como o LG) e tenant em `auth.identities`; adota o cadastro legado com o mesmo id; cria cadastro novo só na fase primary. O gatilho legado `on_auth_user_created` **não é alterado**. | Ninguém do projeto compartilhado altera gatilhos de `auth.users`; GC e lic_ dependem das linhas que ele cria. |
| D-08 | Auditoria por gatilhos `AFTER` nas tabelas `luzia_`, gravando em `public.luzia_audit_events` na mesma transação; eventos de auditoria e de acesso são somente inserção. | Atomicidade garantida pelo banco. |
| D-09 | Matriz hierárquica implementada uma vez no banco (`private.luzia_visible_collaborator_ids()`) e espelhada em TypeScript (`src/lib/auth/matrix.ts`) só para interface e validação antecipada; testes verificam que as duas coincidem. | Spec 4 e 8: matriz centralizada, aplicação efetiva no servidor e no RLS. |
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
| D-20 | Duas fases em `luzia_settings.phase`: **coexistence** (luzia_ é cópia importada por `private.luzia_import_legacy()`, idempotente; administração somente leitura no hub novo; nada é escrito no legado) e **primary** (luzia_ é a fonte; espelho para o legado). | O hub antigo continua operando sem mudança até o corte; nunca há duas fontes editáveis ao mesmo tempo. |
| D-21 | Clientes só têm `SELECT` nas tabelas `luzia_`; toda escrita passa por RPCs `public.luzia_admin_*` (`security definer`, admin ativo + fase primary). | Padrão do LG e do GC; elimina escrita direta pelo PostgREST. |
| D-22 | Espelho: novos IDs de departamento/colaborador vêm das sequências legadas (o gatilho insere em `public.dpto`/`public.users` e usa o id devolvido); atualizações replicam nome, e-mail, departamento, cargo, admin e identidade; **nunca apaga** linhas legadas. Departamentos e colaboradores são desativados, não excluídos. | Mantém IDs iguais nos dois lados e protege as FKs do GC (`cascade` apagaria dados dele). |
| D-23 | Estado de acesso (`access_status`), aplicações, audiências, novidades e eventos existem só em `luzia_`. | O legado não tem onde guardá-los; o GC controla o próprio acesso por papéis. |
| D-24 | Aplicações, novidades e auditoria com id `uuid` (eventos com `bigint identity`); departamentos e colaboradores com `bigint` igual ao legado; `legacy_app_id` guarda a origem da aplicação importada. | Convenção do LG/GC para entidades novas; compatibilidade de IDs onde outros sistemas referenciam. |
| D-25 | `signOut({ scope: "local" })` no hub. | Encerra a sessão do hub (a mesma entregue às apps em iframe) sem derrubar as sessões do usuário no LG/GC. |

## Mudanças de comportamento em relação ao legado (destacar na revisão de transição)

Valem para o hub novo; o hub antigo segue com as regras dele até o corte.

1. "Não atribuído" (e quem veio do legado sem departamento) não recebe nenhuma aplicação, nem as globais (legado: recebia as globais — RN-02).
2. Audiência explícita (`all_departments` / `selected_departments`); `selected_departments` exige ≥1 departamento. Importação: app sem vínculos → `all_departments`.
3. Estado de acesso no hub: inativo não lê dados protegidos, não abre apps nem recebe sessão. **Não é espelhado** ao legado: o HelpDesk GC e o lic_ não ficam sabendo (desligamento continua exigindo Entra + cada sistema).
4. Só sessões de login Microsoft enxergam dados `luzia_` (sessão por e-mail/senha de outra app no mesmo projeto não serve).
5. Última conta administrativa ativa não pode ser removida; troca de identidade só com motivo auditado.
6. Departamentos, colaboradores e aplicações não são excluídos: são desativados.
7. Relatórios do hub novo começam do zero (o histórico de `access_log` fica no legado); novidades antigas não aparecem.

## Lacunas e dependências externas concretas

| ID | Dependência | Bloqueia | Quem/onde |
|---|---|---|---|
| X-01 | O projeto compartilhado é produção e não há staging (regra documentada no LG/GC). Ensaio real precisa de Docker para `supabase start` ou de aprovação para aplicar a fundação no projeto compartilhado (fase coexistence, sem escrita no legado) | Teste real de RLS via PostgREST, Auth, Storage, AC-08, AC-16 real | Dono do produto / infraestrutura |
| X-02 | Dump **somente de schema** do banco compartilhado (`pg_dump --schema-only`): tabelas, tipos de coluna, nomes de políticas, funções, gatilhos, grants | Confirmar tipos de id, nomes de índices/políticas, gatilho legado e ajustar a migração candidata | Responsável pelo Supabase |
| X-03 | Valor do tenant ID para `luzia_settings.azure_tenant_id` (caminho `custom_claims.tid` **confirmado** no inventário, 1 tenant) | Validação de tenant (AC-01) | Admin Microsoft 365 |
| X-04 | App registration single-tenant com redirect para o domínio de staging do novo hub; configuração "Allow new users to sign up" (R-02) | Login real | Admin Microsoft 365 / Supabase |
| X-05 | Uma aplicação de referência em staging que aceite a origem do novo hub em `HUB_ORIGIN` | AC-08 real | Desenvolvimento (Lovable) |
| X-06 | Schemas de `comparisons`/`profiles` (Fisco Check) e `acoes`/`mensagens`/`boas_vindas`/`perfis` (Tributário) | Adaptadores de atividades reais (AC-12 real) | Desenvolvimento |
| X-07 | Código do hub legado | Conferir regras não documentadas (ex.: nomes das funções `current_user_*`, bucket) | Responsável |
| X-08 | Não há backup/PITR além do próprio banco (informado em 20/10/2026). A fundação (coexistência) foi aplicada assim por não escrever no legado; **o corte exige salvaguarda antes** (ex.: cópia lógica de `public.users`/`public.dpto` guardada fora do repositório, ou plano com backup) | Corte (fase primary) | Dono do produto / infraestrutura |
| X-09 | Política de retenção de acessos/atividades/auditoria e quem pode ler auditoria | Expurgo (não implementado) | Escritório |
| X-11 | Políticas reais do bucket `app-icons` | Admin desativado ainda poderia enviar ícones se as políticas legadas usarem `current_user_is_admin()` (não verifica estado) | Responsável pelo Supabase |
| X-12 | Normalização de e-mail (maiúsculas) nas tabelas de perfil das apps | Atividades de quem tem e-mail com maiúsculas na app | Desenvolvimento |
| X-10 | Aprovação das propostas (Não atribuído, estado de acesso, audiência explícita, última conta admin) | Aplicar a migração em ambiente compartilhado | Dono do produto |
| X-13 | ~~Colunas e restrições reais de `public.users`/`public.dpto`~~ — **resolvido** pelo inventário de 20/10/2026 | — | — |
| X-15 | ~~Confirmar se `user_id`/`dpto_id` são identity~~ — **resolvido**: `GENERATED ALWAYS` | — | — |
| X-16 | Revisar os 25 vínculos aplicação × departamento (F-01): hoje todos veem tudo | Expectativa dos colaboradores no corte | Dono do produto |
| X-14 | ~~Claims `amr`/provedor no token real~~ — **confirmado** em 20/10/2026 (login real lê dados `luzia_`) | — | — |
