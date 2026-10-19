# Luz.IA — Spec Operacional

| | |
|---|---|
| Versão | 1.0 |
| Data | 2026-10-19 |
| Autor | Arildo Maldonado (Desenvolvimento) — rascunho técnico por Claude |
| Dono do produto | Escritório Lógica Contabilidade |
| Finalidade | Descrever como o Luz.IA **funciona e é operado hoje**, para que outra IA/pessoa derive dele uma spec de ambiente de desenvolvimento (VSCode) e consiga trabalhar no projeto sem adivinhar. |

---

## 0. Como ler este documento

**Marcadores de confiança** (use-os ao derivar outras specs; não promova `[A CONFIRMAR]` a fato):

- `[CÓDIGO 19/10]` — lido diretamente no código-fonte do Hub nesta data.
- `[CONFIRMADO dd/mm]` — verificado na prática (consulta ao banco, bundle publicado, teste do usuário) na data indicada.
- `[DOC]` — vem da documentação interna (PDFs de 21–22/09) e **pode estar desatualizado**.
- `[A CONFIRMAR]` — hipótese ou informação não reverificada.

**Política de segredos (obrigatória):** este documento não contém e não deve receber chaves, tokens, senhas nem valores de variáveis de ambiente. Só nomes de variáveis. Se uma spec derivada precisar de um valor, ela deve dizer "pegar no cofre/painel X", nunca colar o valor. A *anon key* do Supabase é pública por desenho, mas mesmo assim não é reproduzida aqui.

**Idioma:** domínio e interface em português; identificadores de código misturam inglês (tabelas, colunas) e português (tipos e variáveis do front do Hub).

---

## 1. Visão geral

O **Luz.IA** é o hub interno do escritório: um portal com **login único** (conta Microsoft 365 do escritório) que lista e abre as aplicações internas, controla quem vê o quê (cargo + departamento), registra acessos e mostra relatórios gerenciais.

**Objetivos**
1. Um único login para todas as aplicações internas (hoje 6, todas construídas no Lovable).
2. Um único banco de contas (`auth.users`) e um único projeto Supabase compartilhado.
3. Controle de acesso por departamento (quais apps cada um vê) e por cargo (quem enxerga quem nos relatórios).
4. Visibilidade gerencial: quem abriu o quê (Logs de Acesso) e o que foi feito dentro de cada app (Atividades).

**Fora de escopo hoje:** SSO por protocolo padrão (SAML/OIDC entre Hub e apps — o SSO é por `postMessage` de sessão Supabase), billing, multi-tenant (single-tenant, só `@escritoriologica.com.br`).

---

## 2. Arquitetura

```
 Usuário ──(Microsoft/Azure AD)──▶ Hub (Next.js, Vercel)  ──┐
                                      │  iframe + postMessage │ lê/escreve
                                      ▼                       ▼
                         App Lovable (TanStack Start, SPA)   Supabase (projeto único compartilhado)
                         ├─ app-client.ts  (anon key hardcoded) ─▶  auth.users  (identidade única)
                         └─ *.server.ts    (service role via env    ├─ tabelas do Hub  (dpto, users, applications…)
                            customizada)                            ├─ fiscocheck: profiles, user_roles, comparisons
                                                                    ├─ tributário: perfis, papeis, mensagens, acoes, boas_vindas…
                                                                    ├─ perdcomp:   pc_*
                                                                    ├─ contcheck:  cc_*
                                                                    └─ tax planner: tp_*
```

Princípios arquiteturais `[CONFIRMADO]`:
- **Banco único**: o Hub e todas as apps usam o projeto Supabase `olyvjnqmrzkziirzbmhi` (`https://olyvjnqmrzkziirzbmhi.supabase.co`). Uma conta autentica uma vez e vale em todas.
- **Tabelas por app com prefixo** (`cc_`, `pc_`, `tp_`) para não colidir. Exceções legadas sem prefixo: Fisco Check (`profiles`, `user_roles`, `comparisons`) e Conecta Tributário/tax-hub-central (`perfis`, `papeis`, `mensagens`, `acoes`, `declaracoes`, `boas_vindas`…).
- **O Hub não vê o schema das apps** diretamente; para "Atividades" ele usa a service role no servidor (seção 10).
- **Apps rodam embutidas** num `<iframe>` dentro do Hub e recebem a sessão por `postMessage`.

---

## 3. Stack e ambientes

| Camada | Tecnologia | Observação |
|---|---|---|
| Hub | Next.js **16.3.1** (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, lucide-react, recharts | `AGENTS.md` do repo avisa: *"This is NOT the Next.js you know"* — ler `node_modules/next/dist/docs/` antes de codar `[CÓDIGO 19/10]` |
| Hosting do Hub | Vercel, projeto `luz-ia/hub`, domínio de produção **`https://hub-logica.vercel.app`** | Domínio antigo `hub-ivory-eta.vercel.app` foi substituído em set/2026; vários documentos ainda o citam |
| Banco/Auth | Supabase (Postgres + Auth + Storage) | Projeto único compartilhado |
| Login | Azure AD / Microsoft 365, single-tenant, provedor `azure` do Supabase | Escopos `email openid profile` |
| Apps | Lovable → **TanStack Start** (React Router + server functions), forçadas a SPA (sem SSR) | Repositórios GitHub na organização `desenvolvimento-logica` |
| Hosting das apps | Lovable (publicação própria) | URLs ficam em `applications.app_url` |

**Variáveis de ambiente do Hub** (só nomes) `[CÓDIGO 19/10]`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente e middleware.
- `SUPABASE_SERVICE_ROLE_KEY` — **somente servidor** (rotas `/api/atividades/*`). Se ausente, as rotas respondem 500 "Integração não configurada".
- `.env.local` local também contém `VERCEL_OIDC_TOKEN` (gerado pela CLI da Vercel; não versionar).

**Variáveis por app** (nomes; valores = service role do projeto compartilhado, no painel do Lovable de cada app) `[CONFIRMADO]`:
`PERDCOMP_SUPABASE_SERVICE_ROLE_KEY`, `TAXPLANNER_SUPABASE_SERVICE_ROLE_KEY`, `CONTCHECK_SUPABASE_SERVICE_ROLE_KEY`; Fisco Check usa `office-supabase.server.ts` (nome da variável `[A CONFIRMAR]`); tax-hub-central usa `VITE_HUB_URL` para a origem do Hub.
**Nunca** usar os nomes reservados (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_*`) para o projeto compartilhado — ver seção 12.

---

## 4. Hub — rotas e funcionalidades `[CÓDIGO 19/10]`

| Rota | Quem acessa | Função |
|---|---|---|
| `/login` | público | Botão "Entrar com Microsoft" (`signInWithOAuth`, provider `azure`, `redirectTo=/auth/callback`) |
| `/auth/callback` | público | Troca `code` por sessão e redireciona para `next` (padrão `/`) ou `/login?erro=auth` |
| `/` | logado | **Gerencial** (`GerencialDashboard`) se `podeVerGerencial`, senão **Launcher** (`AppLauncher`) |
| `/aplicacoes` | cargo ≠ usuário (ou admin) | Catálogo de aplicações |
| `/aplicacoes/[id]` | logado com acesso | Abre a app em iframe, entrega a sessão (seção 7) e registra o acesso em `access_log` |
| `/logs` | cargo ≠ usuário (ou admin) | Dois modos: **Acessos** (tabela `access_log`) e **Atividades** (chama `/api/atividades/{fiscocheck|tributario}`) |
| `/admin` (+ `departamentos`, `usuarios`, `aplicacoes`, `novidades`) | `is_admin` | CRUD; layout mostra "Acesso restrito" para não-admin |
| `/api/atividades/fiscocheck` | cargo ≠ usuário | Lista comparações do Fisco Check no escopo do usuário (limite 300) |
| `/api/atividades/tributario` | cargo ≠ usuário | Lista ações de Mensagens e comunicados de Boas-vindas no escopo (limite 300) |

Outros: sino de **Novidades** (`patch_notes`, leitura para todos, escrita só admin), tema claro/escuro, sidebar recolhível, paleta de marca `chumbo` (cinza) e `amarelo`.

**Proteção de rotas:** `src/middleware.ts` + `lib/supabase/middleware.ts` redirecionam para `/login` qualquer rota fora de `/login` e `/auth/callback` sem usuário (`auth.getUser()`), e de `/login` para `/` se já logado.

**Carga de dados:** `AppDataProvider` carrega tudo de uma vez no cliente (dpto, users, applications, applications_dpto, `access_log` **limit 500**, `patch_notes` **limit 50**) e recarrega tudo após cada mutação. O escopo vem do RLS. Consequência: métricas do dashboard são calculadas sobre os **últimos 500 acessos visíveis**, não sobre o histórico completo (ver P-07).

**Ícone das apps:** `applications.app_icon` é um emoji ou uma URL `http…` de imagem (bucket `app-icons`). Imagens são exibidas em proporção fixa **3:4** com `object-cover` (corta laterais de imagens fora da proporção — decisão do usuário em set/2026).

---

## 5. Modelo de dados do Hub e RLS `[CÓDIGO 19/10]`

Arquivos em `hub/supabase/`. **Ordem de execução** (SQL Editor): `schema.sql` → `rls.sql` → `auth-link.sql` → `auto-provisionamento.sql` → `seed.sql` (só carga inicial) → `patch-notes.sql` → `storage.sql`. Apps em `supabase/apps/` (`fiscocheck-schema.sql`, `perdcomp-schema.sql`).

> ⚠️ **`schema.sql` começa com `drop table … cascade` em todas as tabelas do Hub.** Nunca rodar em produção; só em ambiente vazio. Mudanças em produção devem ser scripts incrementais (`alter`/`create … if not exists`).

| Tabela | Colunas-chave | Notas |
|---|---|---|
| `dpto` | `dpto_id` (PK identity), `dpto_name` (unique), `dt_create`, `user_create` | Existe o departamento especial **"Não atribuído"** (criado pelo auto-provisionamento) |
| `users` | `user_id` (PK), `auth_user_id` (uuid, unique → `auth.users`), `user_name`, `user_email` (unique), `user_dpto` (FK), `user_role` ∈ {`usuario`,`lider`,`coordenador`,`gerente`,`diretor`}, `is_admin` (bool) | `is_admin` é **independente** do cargo. Carga inicial: 124 colaboradores (`seed.sql`) |
| `applications` | `app_id`, `app_name`, `app_description`, `app_url`, `app_icon`, `app_status` (bool ativo), `dt_created`, `user_created` | |
| `applications_dpto` | PK (`app_id`,`dpto_id`) | **Sem nenhuma linha para uma app = liberada a todos**; com linhas = só esses departamentos |
| `access_log` | `log_id`, `user_id` (FK users), `app_id` (FK applications), `datetime` | Índices por user, app e datetime |
| `patch_notes` | `note_id`, `note_title`, `note_body`, `note_version`, `dt_publish`, `user_create` | |
| storage `app-icons` | bucket público | Leitura pública; insert/update/delete só admin |

**Funções SECURITY DEFINER** (evitam recursão de RLS): `current_user_id()`, `current_user_role()`, `current_user_dpto()`, `current_user_is_admin()`.

**Políticas (resumo):**
- `dpto`, `applications_dpto`, `patch_notes`: `select` para qualquer autenticado; escrita só admin.
- `users`: `select` escopado (próprio registro; admin/diretor/gerente veem todos; coordenador vê `usuario`+`lider` do seu depto; líder vê `usuario` do seu depto); escrita só admin.
- `applications`: admin vê tudo; demais veem só `app_status = true` **e** (sem restrição **ou** departamento do usuário liberado).
- `access_log`: `select` com a mesma hierarquia de `users`; `insert` só com `user_id = current_user_id()`; update/delete só admin.

---

## 6. Identidade, login e provisionamento

Fluxo `[CÓDIGO 19/10]`:
1. `/login` → OAuth Azure → Supabase cria/atualiza `auth.users`.
2. Trigger em `auth.users` (`link_auth_user_to_app_user`, versão de `auto-provisionamento.sql`): se já existe `users` com o mesmo e-mail (case-insensitive) e `auth_user_id` nulo → vincula; **senão cria** `users` com `user_role='usuario'`, `is_admin=false`, departamento **"Não atribuído"**, `user_create='auto-provisionamento-azure-ad'`. Nome vem de `full_name`/`name` do token ou do prefixo do e-mail.
3. Trigger inverso em `users` (`link_app_user_to_auth_user`) cobre quem é cadastrado depois de já ter logado.
4. `CurrentUserProvider` busca `users` por `auth_user_id`; se não achar, mostra "Acesso ainda não liberado" (caso residual).

Regras decorrentes:
- **RN-01** Todo login Microsoft do tenant gera cadastro no Hub. Desativar acesso de quem saiu = **desativar a conta no Azure AD**; o Hub não faz isso (o cadastro em `users` permanece).
- **RN-02** Cadastro inicial só enxerga apps abertas a todos e nenhuma tela gerencial até um admin definir departamento/cargo.
- **RN-03** O vínculo entre Hub e apps é **pelo e-mail corporativo idêntico**. E-mail diferente (typo, alias) = a pessoa some dos relatórios de Atividades.
- Conta de bootstrap admin: `desenvolvimento@escritoriologica.com.br`.

---

## 7. Contrato SSO Hub ↔ aplicação `[CÓDIGO 19/10]` + `[CONFIRMADO]`

**Hub (`/aplicacoes/[id]`)**
- Renderiza `<iframe src={app.url}>`.
- Envia a sessão com `postMessage` ao `iframe.contentWindow`, com `targetOrigin = new URL(app.url).origin`, nos dois gatilhos (o que ocorrer primeiro): `onLoad` do iframe **e** ao receber `LUZIA_READY` vindo de `origin === origem da app`.
- Mensagem: `{ type: "LUZIA_SESSION", access_token, refresh_token }`.

**App (arquivo `src/lib/hub-session-listener.ts`)**
- Constante `HUB_ORIGIN = "https://hub-logica.vercel.app"` (na tax-hub-central vem de `VITE_HUB_URL`).
- Escuta `message`; ignora se `event.origin !== HUB_ORIGIN` ou `type !== "LUZIA_SESSION"`; chama `supabase.auth.setSession({access_token, refresh_token})` **no client `app-client`**.
- Ao carregar, envia `{type:"LUZIA_READY"}` para `window.parent` com target `HUB_ORIGIN`.
- Deve ser importado na primeira linha do router/entry, nunca dentro de componente atrás do gate de login.

**Requisitos de cada app (checklist de conformidade)**
1. Cliente Supabase **hardcoded** em `src/integrations/supabase/app-client.ts` (URL do projeto compartilhado + anon key), e **todo** import de `supabase` no app aponta para ele.
2. `auth-attacher.ts` importa de `./app-client`.
3. `auth-middleware.ts` usa URL/anon hardcoded e **`getUser(token)`** (não `getClaims`).
4. Service role só via variável de ambiente de nome customizado, em arquivo `app-admin.server.ts`, reexportado por `client.server.ts`.
5. SPA pura: sem SSR em nenhuma rota (SSR parcial causa `React error #418` no iframe).
6. Gate de login que **não** mostra formulário de senha quando a sessão chega do Hub (o `getUser()` do gate usa o mesmo client do listener).

**Segurança do contrato:** o `targetOrigin` limita a entrega do token à origem cadastrada em `app_url`; por isso `app_url` só deve ser editado por admin e nunca apontar para domínio não controlado.

---

## 8. Papéis, visibilidade e regras de negócio

**Cargos** (`NIVEL_CARGO`): usuario 0 < lider 1 < coordenador 2 < gerente 3 < diretor 4. Mais o flag `is_admin`.

**RN-10 — Quem enxerga quem** (Dashboard, Logs de Acesso e Atividades; mesma regra no RLS e em `usuariosVisiveisPara()`):

| Quem | Enxerga |
|---|---|
| admin, diretor, gerente | todos os colaboradores |
| coordenador | `usuario` e `lider` do **próprio** departamento |
| líder | `usuario` do **próprio** departamento |
| usuario | ninguém (sem telas gerenciais) |

**RN-11 — Acesso a apps:** `usuarioTemAcessoAplicacao` = admin **ou** app sem restrição **ou** departamento do usuário em `applications_dpto`. Independe do cargo.
**RN-12 — Telas gerenciais** (`podeVerGerencial`): `is_admin` **ou** cargo ≠ `usuario`.
**RN-13 — Administração** (`/admin`): só `is_admin`.
**RN-14 — Registro de acesso:** cada abertura de `/aplicacoes/[id]` insere uma linha em `access_log` (uma vez por montagem da página), feita pelo próprio usuário.
**RN-15 — Remoção:** apagar departamento/usuário/app com registros dependentes falha (FK `23503`) com a mensagem "existem registros vinculados"; valor duplicado (`23505`) também tem mensagem própria.

**Papéis dentro das apps** são independentes dos do Hub (cada app tem seu próprio perfil/papel): ex. contcheck tem `cc_app_role` = admin > coordenador > lider > usuario com a mesma lógica hierárquica de visibilidade nas suas tabelas.

---

## 9. Registro de aplicações (estado conhecido)

Responsável de todas: **Desenvolvimento** + coordenação do departamento usuário `[DOC 22/09]`. Acesso/retirada: regra geral do Hub (RN-11, RN-01).

| App | Departamento | Repo (org `desenvolvimento-logica`) | Tabelas no banco compartilhado | Integração SSO | Atividades no Hub | Status |
|---|---|---|---|---|---|---|
| **Fisco Check** | Fiscal | `fiscocheck-dbc5d387` | `profiles`, `user_roles`, `comparisons` | Sim | Sim (`/api/atividades/fiscocheck`) | Funcionando. Histórico anterior à integração **ainda no banco antigo** `[DOC 22/09 — A CONFIRMAR]` |
| **Mensagens (e-CAC)** | Tributário | `tax-hub-central` | `perfis`, `papeis`, `mensagens`, `acoes`, … | Sim | Sim (`/api/atividades/tributario`) | Funcionando. Dados vêm do GOB |
| **Boas-vindas** | Tributário | `tax-hub-central` `[A CONFIRMAR: entrada própria no Hub apontando para a rota]` | `boas_vindas` | Sim | Sim (mesma rota) | Funcionando; gera PDF de 2 páginas |
| **PERDCOMP** | Tributário | `perdcomp-pilot` | `pc_profiles`, `pc_user_roles`, `pc_declaracoes`, `pc_status_historico`, `pc_acompanhamentos`, `pc_auditoria_achados`, `pc_alertas`, `pc_log_alteracoes` | Sim | **Não** | Integrado e migrado em 22/09 (2.953 declarações). Sem atividade no Hub (ver P-05) |
| **contcheck** (Auditoria Contábil) | Contábil | `contcheck` | `cc_profiles`, `cc_user_roles`, `cc_analyses` (+ `cc_app_role`, `private.cc_has_role`) | **Sim, confirmado 01/10** | **Não** | SSO funcionando; **441 análises, 26 perfis** migrados (01/10). ~8 colaboradores reais ainda sem conta no Luz.IA |
| **CPA Tax Planner** | Tributário | `cpa-tax-planner` | `tp_profiles`, `tp_estudos` | Sim (22/09) | **Não** | Dados reais removidos do código-fonte em 21–22/09 (incidente); persistência no banco; **sem controle de edição simultânea** |

Detalhes úteis:
- contcheck: trigger `cc_handle_new_user` (em `auth.users`, nome `on_auth_user_created_cc`) só provisiona perfil quando o usuário nasce do próprio contcheck (metadata `perfil`, `self_signup`) ou é o admin padrão — **não** cria perfil para usuários criados por outras apps. Admin do contcheck cria usuários em lote com senha provisória (`bulkCreateUsers`), com `must_change_password`.
- PERDCOMP: responsável interno só ~51% preenchido (backfill via sincronização GOB não esgotado); o histórico individual de atribuição do sistema antigo não existe.
- Tax Planner: `tp_estudos.cnpj` é único; o último a salvar sobrescreve.

---

## 10. Atividades (relatórios do que foi feito dentro das apps)

Mecanismo `[CÓDIGO 19/10]` (`lib/supabase/activity-scope.ts`):
1. Autentica o usuário (`auth.getUser()`); 401 se não logado.
2. Carrega a própria linha em `users`; 403 se `usuario` sem `is_admin`.
3. Cria cliente **service role** (`SUPABASE_SERVICE_ROLE_KEY`) para ler tabelas da app (cujo RLS é incompatível com o do Hub); 500 se a variável faltar.
4. Lê `users` **com o RLS do usuário logado** e monta `e-mail → {nome, departamentoId}` — este é o escopo de visibilidade.
5. A rota filtra os perfis da app cujo e-mail está nesse mapa e retorna só atividades desses perfis, enriquecidas com nome/departamento do Hub. Parâmetro `?debug=1` devolve diagnóstico de e-mails dentro/fora do escopo.

**Invariante de segurança:** a rota usa service role (ignora RLS), então **a checagem de escopo é responsabilidade do código** — qualquer nova rota de atividade deve passar por `escopoAtividades()`.

Para adicionar uma app às Atividades: nova rota `/api/atividades/<app>` seguindo o padrão + entrada em `APPS_ATIVIDADE` de `logs/page.tsx` + tipo em `lib/types.ts`. Hoje só **Fisco Check** e **Mensagens/Boas-vindas** estão ligados (`types.ts` já prevê `origem: "PER/DCOMP"`, mas a rota não o lê).

---

## 11. Runbooks (procedimentos operacionais)

**RB-01 — Admissão (novo colaborador)**
1. Criar/ativar a conta Microsoft 365 com e-mail `@escritoriologica.com.br`.
2. Colaborador entra no Luz.IA (cadastro automático: `usuario` / "Não atribuído").
3. Admin: Administração › Usuários → definir departamento, cargo e `is_admin`.
4. Passa a ver as apps liberadas ao departamento. Cada app cria o perfil próprio no primeiro acesso (contcheck: ainda depende de provisionamento próprio — ver P-03).
5. Conferir que o e-mail é idêntico em todas as apps (RN-03).

**RB-02 — Desligamento / retirada de acesso**
1. Desativar a conta no Azure AD (não há desativação no Hub).
2. Opcional: remover o `users` no Hub (só se não houver `access_log` que o referencie, senão RN-15) ou trocar o departamento para um sem apps liberadas.
3. Apps com login por senha próprio (ex.: contcheck `/auth`, usuários criados por admin) **continuam com credencial local** — desativar também lá (P-02).

**RB-03 — Liberar ou retirar uma app para um departamento**
Administração › Aplicações → alternar departamentos (insere/remove em `applications_dpto`). Lembrar: **nenhum departamento marcado = todos**. Desativar a app inteira: alternar `app_status`.

**RB-04 — Cadastrar uma nova app no Hub**
Administração › Aplicações → nome, descrição, URL **publicada**, ícone (emoji ou upload 3:4), departamentos. A URL define o `targetOrigin` do SSO.

**RB-05 — Integrar uma nova app Lovable (checklist)**
1. Apontar a app ao projeto compartilhado: arquivo **novo** `app-client.ts` com URL/anon key hardcoded; trocar **todos** os imports; `grep` para provar que nenhum arquivo importa o `client.ts` gerado.
2. Criar `hub-session-listener.ts` (seção 7) e importá-lo na primeira linha do router.
3. Corrigir plumbing de servidor: `auth-attacher.ts` → `./app-client`; `auth-middleware.ts` → hardcode + `getUser`; `app-admin.server.ts` + `client.server.ts` com env customizada.
4. Forçar SPA (sem SSR) e substituir a rota raiz por gate de login que aceita a sessão do Hub.
5. Criar o schema **do zero** no projeto compartilhado com prefixo próprio, RLS restrita aos usuários daquela app (função `private.<prefixo>_e_colaborador()` ou hierarquia própria), `grant` explícito, e bootstrap do admin. Não habilitar trigger global em `auth.users` que provisione perfil para todo mundo.
6. Cadastrar a env var da service role com **nome customizado** no Lovable.
7. Cadastrar a app no Hub (RB-04) e testar ponta a ponta: login pelo Hub → abre sem pedir senha → acesso aparece em Logs.
8. (Opcional) ligar às Atividades (seção 10).
9. Migrar histórico, se houver (RB-08).

**RB-06 — Mudança de domínio do Hub**
Atualizar: Supabase Auth › URL Configuration (Site URL e Redirect URLs); `HUB_ORIGIN` em **cada app** (ou `VITE_HUB_URL` na tax-hub-central); domínio no Vercel. Em set/2026 a troca quebrou login e todos os SSOs simultaneamente.

**RB-07 — Deploy do Hub**
Vercel, projeto `luz-ia/hub`. O `supabase/README.md` descreve deploy manual `npx vercel --prod --yes` e ausência de Git remoto `[DOC — A CONFIRMAR se ainda é assim]`. Variáveis em Production (nomes na seção 3).

**RB-08 — Migração de dados históricos de uma app antiga (padrão já usado em PERDCOMP e contcheck)**
1. Obter export JSON do banco antigo (por credenciais, ou via rota temporária no Lovable usando o cliente **nativo** do projeto antigo — funcionou no contcheck; apagar a rota depois).
2. Gerar SQL com script Python: remapeia **todo FK de usuário por e-mail** (`(select id from auth.users where lower(email)=…)`), usa `on conflict … do nothing`, divide em arquivos < ~250 KB (limite prático do SQL Editor), e usa **casts explícitos** quando insere via `select … from (values …)` (senão o Postgres tipa literais como `text`).
3. Colunas `NOT NULL` com FK de usuário: filtrar com `where user_id is not null` para descartar (não falhar) quem ainda não tem conta; o import é **idempotente** e pode ser reexecutado depois de provisionar essas pessoas.
4. Tabela de correção de e-mails (`EMAIL_OVERRIDES`) para typos no sistema antigo.
5. Validar por contagem (esperado vs. real) e investigar a diferença.

**RB-09 — Verificar de verdade se algo foi publicado (não confiar em "publicado")**
```bash
# 1) arquivo de entrada atual da app publicada
curl -sL "https://<app>/" | grep -oE '/assets/index-[A-Za-z0-9_-]*\.js'
# 2) procurar string que só existe depois da mudança
curl -sL "https://<app>/assets/index-XXXX.js" | grep -c "LUZIA_SESSION"
# 3) tabela existe no banco compartilhado? (404 = não existe; 200 vazio pode ser só RLS)
curl -s -o /dev/null -w "%{http_code}\n" "https://olyvjnqmrzkziirzbmhi.supabase.co/rest/v1/<tabela>?select=*&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```
Com `anon`, uma tabela com RLS responde 200 e `[]` — **isso não prova que há dados**; contagens reais só pelo SQL Editor (que ignora RLS).

---

## 12. Armadilhas conhecidas (Lovable / TanStack Start) `[CONFIRMADO]`

1. **`auth-attacher.ts` importando `./client`** (auto-gerado, aponta para o backend antigo) → "Unauthorized: No authorization header provided".
2. **`getClaims(token)`** exige chaves assimétricas; o projeto compartilhado usa JWT legado HS256 → "Unauthorized: Invalid token" mesmo com token válido. Usar `getUser(token)`.
3. **Variáveis reservadas são revertidas pelo Lovable a cada publish** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_*`). Solução: URL/anon hardcoded em arquivo próprio + env **customizada** para a service role.
4. **Imports do client errado em rotas** (ex.: gate `_authenticated/route.tsx`, `auth.tsx`, `change-password.tsx` no contcheck): o listener grava a sessão num client e o gate lê de outro → continua pedindo senha. Sempre auditar por `grep`.
5. **SSR parcial em iframe** → `React error #418`.
6. **"Publicado" ≠ publicado**: já houve confirmação de sucesso com bundle sem o código; já houve "feito" sem publicar. Verificar pelo bundle (RB-09).
7. **Anon key hardcoded é aceitável; service role nunca** (nem em código, nem em bundle, nem em chat).

---

## 13. Segurança

**Invariantes**
- **INV-1** Service role jamais no cliente/bundle e jamais em documento. Só variável de ambiente de servidor.
- **INV-2** Todo acesso do Hub a dados de app por service role passa por `escopoAtividades()`.
- **INV-3** RLS ligada em toda tabela nova; `grant` explícito por papel; políticas "para qualquer autenticado" só em dados não sensíveis.
- **INV-4** Funções usadas em políticas ficam em schema não exposto (`private`) e `security definer` com `search_path` fixo.
- **INV-5** Dados reais de cliente nunca em código-fonte, exemplos ou testes (incidente do CPA Tax Planner, set/2026).
- **INV-6** `app_url` só editável por admin (define para onde o token de sessão é enviado).

**Riscos conhecidos (R-xx)**
- **R-01 (alto) — Código do Hub fora do controle de versão.** `[CÓDIGO 19/10]` O repositório local tem um único commit ("Initial commit from Create Next App"), **sem remote**, e a maior parte do código (`src/app/(app)`, `api`, `components`, `lib`, `middleware.ts`, `supabase/`) está **não rastreada**. Hoje só existe a cópia local (em pasta sincronizada pelo OneDrive) e os deploys da Vercel.
- **R-02 (a verificar) — Superfície de cadastro aberto.** O contcheck mantém `/auth` com formulário de e-mail+senha e **auto-cadastro** (`signUp`) no projeto compartilhado. Se "Allow new users to sign up" (e-mail) estiver ligado no Supabase, qualquer pessoa que alcance a URL pública da app cria uma linha em `auth.users`, o que também dispara o auto-provisionamento do Hub (cria `users` como `usuario`/"Não atribuído"). `[A CONFIRMAR]` nas configurações do Supabase e nas demais apps.
- **R-03 (médio)** Auto-provisionamento cria cadastro para qualquer conta ativa do tenant (inclui contas de serviço e ex-colaboradores não desativados).
- **R-04 (médio)** A mesma service role do projeto compartilhado existe em N variáveis de ambiente (uma por app + Hub). Comprometimento de qualquer uma = acesso total ao banco. Rotação exige atualizar todas.
- **R-05 (médio)** "Aplicação restrita por departamento" é controle de **visibilidade no Hub**; o acesso real aos dados é decidido pelo RLS **de cada app**. Abrir a URL da app diretamente não deve dar acesso — a documentação afirma que as apps recusam fora do Hub, mas isso é `[A CONFIRMAR]` app a app.
- **R-06 (baixo)** Tax Planner sem controle de concorrência (último a salvar vence).
- **R-07 (baixo)** Credenciais de recuperação: cofre Bitwarden criado em 01/10 e compartilhado com a diretoria para acesso durante ausência do responsável; inventário de sistemas críticos (Vercel, Supabase, GitHub, Lovable por app, admin Microsoft 365) — conteúdo do cofre **não** faz parte desta spec.

---

## 14. Estado atual e pendências (P-xx)

Estado em **19/10/2026**, baseado nas últimas verificações; itens sem data posterior a 22/09 devem ser revalidados.

| ID | Pendência | Estado |
|---|---|---|
| P-01 | Migrar histórico de comparações do Fisco Check (banco antigo) | Bloqueado por credenciais em 22/09 `[A CONFIRMAR hoje]`. Hipótese: se o Fisco Check usa backend nativo do Lovable, a rota temporária de exportação usada no contcheck (RB-08) resolve sem credenciais |
| P-02 | Remover/avaliar login por senha e auto-cadastro no contcheck (e checar outras apps) | Aberto (ver R-02) |
| P-03 | contcheck: ~8 colaboradores reais sem conta no Luz.IA; após provisionar, reexecutar `01` e `02-analises-*` | Aberto; 5 contas genéricas/desligadas ignoradas de propósito |
| P-04 | Colocar o Hub sob Git com remote, e versionar scripts de schema/migração hoje soltos | **Aberto — prioridade alta** (R-01) |
| P-05 | Ligar PERDCOMP, contcheck e Tax Planner às Atividades; tipo `PER/DCOMP` já existe em `types.ts` | Não iniciado |
| P-06 | Atualizar documentação: `supabase/README.md` e Doc Técnica citam `hub-ivory-eta.vercel.app`, "sem Git", e dão PERDCOMP/contcheck como "em andamento" | Desatualizada |
| P-07 | Dashboard/Logs calculados sobre os últimos 500 acessos; sem paginação nem agregação no banco | Limitação conhecida |
| P-08 | PERDCOMP: preencher responsáveis restantes (~49%) | Baixa urgência |
| P-09 | Tax Planner: controle de edição simultânea | Não iniciado |
| P-10 | Rotina de desativação cruzada (Azure AD → Hub → apps com senha própria) | Não existe; processo manual |

**Artefatos fora do repositório (risco de perda):**
`Downloads\tax-planner-schema.sql`, `Downloads\contcheck-schema.sql`, `Downloads\contcheck-import\` (22 arquivos), `Downloads\perdcomp-import\` (24 arquivos), geradores Python (`build_perdcomp_import.py`, `build_contcheck_import.py`) em pasta temporária de sessão do Claude, exports JSON com dados reais em `Downloads` (**contêm dados pessoais e de clientes — tratar como sensíveis**).

---

## 15. Mapa de arquivos do Hub `[CÓDIGO 19/10]`

```
hub/
├─ AGENTS.md / CLAUDE.md        # regra: ler docs do Next 16 em node_modules antes de codar
├─ src/
│  ├─ middleware.ts             # gate de autenticação (matcher exclui estáticos)
│  ├─ app/
│  │  ├─ login/ · auth/callback/
│  │  ├─ (app)/                 # layout autenticado: page.tsx, aplicacoes/, aplicacoes/[id]/, logs/, admin/*
│  │  └─ api/atividades/{fiscocheck,tributario}/route.ts
│  ├─ components/               # AppShell, Sidebar, Header, AppLauncher, GerencialDashboard, AppIcon, AppImageUploader, NotificationBell, charts/, ui/
│  └─ lib/
│     ├─ auth-context.tsx       # usuário atual (users por auth_user_id)
│     ├─ data-context.tsx       # carga e CRUD de todo o Hub
│     ├─ types.ts               # Cargo, regras de visibilidade e acesso
│     ├─ metrics.ts · format.ts
│     └─ supabase/{client,server,service,middleware,activity-scope}.ts, database.types.ts
└─ supabase/                    # scripts SQL (ordem na seção 5) + apps/
```

---

## 16. Orientações para quem for escrever a spec do VSCode

A spec derivada deve cobrir, no mínimo — e **sem inventar** o que estiver `[A CONFIRMAR]`:

1. **Workspace multi-repositório:** Hub (Next.js, local) + 5 repos Lovable/TanStack Start (GitHub `desenvolvimento-logica`). Definir estrutura de pastas e se vira *multi-root workspace*.
2. **Ambiente Windows:** caminho do Hub está dentro de OneDrive (`…\Projetos\Luz.IA\hub`) **com `node_modules` e `.next`** — recomendar excluir da sincronização ou mover para fora do OneDrive. Em clones, usar caminho curto e `git -c core.longpaths=true` (já ocorreu "Filename too long").
3. **Shells:** PowerShell (principal) e Git Bash; comandos da spec devem ter variante para ambos.
4. **Qualidade:** `npm run dev | build | lint` do Hub; ESLint 9 com `eslint-config-next`; TypeScript estrito; regra de ler a doc do Next 16 antes de usar APIs (não confiar em memória).
5. **Tarefas/atalhos úteis:** rodar o Hub local com `.env.local` (nomes na seção 3, valores fora do repo), checar tabelas (RB-09), rodar geradores Python de migração.
6. **Extensões/ferramentas:** Supabase (SQL), Tailwind v4, ESLint, Python para scripts de migração; Vercel CLI para deploy (RB-07).
7. **Convenções do projeto:** prefixo de tabela por app; scripts SQL idempotentes (`if not exists`, `on conflict do nothing`); nunca `drop` em produção; nenhuma chave em código/commit/chat; comentários só quando o "porquê" não é óbvio.
8. **Fluxo de trabalho com Lovable:** mudanças nas apps são feitas por **prompt ao Lovable** e depois **verificadas por clone + `grep` + bundle** (RB-09) — a spec do VSCode deve prever a pasta/script para esses clones de verificação.
9. **Primeira tarefa recomendada:** resolver P-04 (Git + remote para o Hub, `.gitignore` revisado para excluir `.env*`, `.claude/`, PDFs e dumps) antes de qualquer outro trabalho.

---

## Apêndice — Glossário

- **Hub / Luz.IA:** portal Next.js que lista apps e centraliza login e relatórios.
- **App integrada:** aplicação Lovable aberta em iframe dentro do Hub.
- **GOB:** sistema externo de gestão de obrigações, fonte de mensagens e declarações PER/DCOMP.
- **PER/DCOMP:** declaração de compensação/restituição tributária junto à Receita Federal.
- **e-CAC:** Centro Virtual de Atendimento da Receita Federal (caixa postal de mensagens).
- **Domínio / Jettax / Portal Nacional:** fontes de dados fiscais/contábeis usadas por Fisco Check e contcheck.
- **RLS:** Row Level Security do Postgres/Supabase.
- **Service role:** chave administrativa do Supabase que ignora RLS.
