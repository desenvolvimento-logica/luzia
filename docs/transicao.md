# Plano de transição (Etapa 5)

Nada deste plano foi executado em ambiente compartilhado. Executar em produção é uma ação separada, com aprovação explícita.

## 0. Pré-requisitos

1. Aprovação das mudanças de autorização listadas em `docs/decisoes.md` (“Mudanças de comportamento”).
2. Backup recente e ponto de recuperação (PITR) confirmados no projeto Supabase compartilhado (X-08).
3. Projeto Supabase isolado (ou Docker para `supabase start`) para o ensaio (X-01).
4. Responsáveis pelas apps cientes de que o hub novo terá outra origem em staging.

## 1. Inventário do banco real (somente leitura)

Executar `supabase/inventory/inventario-somente-leitura.sql` e comparar com `supabase/dev/01_legacy_baseline.sql`:

- tipos de `user_id`, `dpto_id`, `app_id`, `log_id` e de `access_log.datetime` (a migração assume `bigint` e `timestamptz`);
- ação das FKs de `applications_dpto` e `access_log` (a migração assume bloqueio, não `cascade`);
- nomes reais das políticas (a migração as localiza dinamicamente e guarda em `private.policy_backup`);
- gatilhos em `auth.users` (o de corte procura a função `public.link_auth_user_to_app_user`) e o gatilho inverso `link_app_user_to_auth_user`;
- chaves de `identity_data` do provedor `azure` → confirmar onde está o `tid` (a RPC usa `tid` ou `custom_claims.tid`);
- e-mails com maiúsculas em `users` e nas tabelas de perfil das apps (impacto em conciliação);
- origens de `app_url` → valor de `LUZIA_APP_ALLOWED_ORIGINS`; URLs `http://` existentes;
- políticas do bucket `app-icons` (as legadas usam `current_user_is_admin()`, que ignora `access_status`);
- versão do Postgres.

Registrar divergências em `docs/decisoes.md` e ajustar a migração **antes** de qualquer ensaio.

## 2. Ensaio em cópia isolada

1. Restaurar na cópia isolada um dump **somente de schema** + dados pseudonimizados ou sintéticos (nunca exports reais no repositório).
2. Contagens antes (seção 9 do inventário).
3. Aplicar `supabase/migrations/20261019000100_hub_v2_foundation.sql`. Em tabela `access_log` grande, criar antes, fora de transação, `create unique index concurrently access_log_open_id_key on public.access_log (open_id)` (após adicionar a coluna) para evitar bloqueio longo.
4. Configurar o tenant: `insert into private.settings (key, value) values ('azure_tenant_id', '<pegar no Entra>')` — valor fora do repositório.
5. Contagens depois (devem coincidir), backfill de `audience` (`todos` = apps sem vínculo), `Não atribuído` como `provisionamento`.
6. Testar RLS via PostgREST com JWTs de identidades representativas (usuário, líder, coordenador, gerente, admin, desativado, pendente), comparando com `tests/db/authorization.test.ts`.
7. Testar concorrência da última conta admin com duas sessões simultâneas.
8. Ensaiar a reversão (`supabase/rollback/...down.sql`) e reaplicar.

## 3. Coexistência (hub antigo + hub novo no mesmo banco)

Depois da migração, as novas políticas valem também para o hub antigo:

- **Congelar o cadastro de aplicações e departamentos no hub antigo.** Ele não conhece `audience`; uma app criada lá nasce `selecionados` e o banco recusa a gravação se não houver departamento; remover o último departamento de uma app também é recusado.
- Colaboradores em “Não atribuído” deixam de ver apps globais nos dois hubs.
- Desativados (`access_status`) perdem acesso nos dois hubs.
- O hub antigo continua registrando acessos por `insert` direto (agora exige app autorizada).
- O gatilho legado de auto-provisionamento continua ativo até o corte (R-02/R-03 permanecem até lá; o hub novo já nega contas fora do tenant).

## 4. Staging do hub novo

1. Deploy em domínio de staging controlado (não confiar em previews automáticos para SSO).
2. Supabase Auth → URL Configuration: incluir o redirect `https://<staging>/auth/callback`.
3. Variáveis: ver `.env.example` (valores no painel da Vercel/cofre).
4. Em **uma** aplicação de referência, aceitar também a origem de staging no `HUB_ORIGIN` (X-05), verificando pelo bundle publicado (RB-09).
5. Validar AC-01, AC-08 e o restante da coluna “Real” de `docs/criterios-de-aceite.md`.

## 5. Corte

1. Janela combinada; hub antigo em modo leitura.
2. Domínio: seguir RB-06 da spec operacional (Site URL/Redirect URLs do Supabase, `HUB_ORIGIN` de **cada** app, domínio na Vercel). Em set/2026 essa troca quebrou login e todos os SSOs: validar app por app.
3. Aplicar `supabase/cutover/20261019000200_remove_legacy_autoprovision.sql`.
4. Conferir contagens, logins de identidades representativas, abertura de cada app, relatórios.

## 6. Reversão

Restaurar só o deploy **não** reverte o banco. Ordem:

1. Frontend: promover o deploy anterior do hub antigo.
2. Banco: `supabase/rollback/20261019000100_hub_v2_foundation.down.sql` (restaura políticas e privilégios guardados; mantém colunas novas, auditoria e backups). Se o corte já ocorreu, recriar o gatilho legado a partir de `private.trigger_backup`.
3. Origens: devolver `HUB_ORIGIN` das apps e as Redirect URLs do Supabase ao domínio anterior.
4. Conferir contagens e login no hub antigo.
