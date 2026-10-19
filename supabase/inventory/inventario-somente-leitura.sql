-- INVENTÁRIO SOMENTE LEITURA do banco compartilhado (Etapa 5, docs/transicao.md).
-- Apenas SELECTs em catálogos do Postgres; não lê linhas de dados pessoais, só contagens.
-- Executar no SQL Editor de uma CÓPIA isolada ou, com aprovação, no projeto real. Salvar o resultado fora do
-- repositório se contiver nomes internos sensíveis; anexar à revisão de transição.

-- 1. Tabelas, colunas e tipos do hub
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
 order by table_name, ordinal_position;

-- 2. Restrições (PK, FK com ação de exclusão, unique, check)
select tc.table_name, tc.constraint_name, tc.constraint_type, pg_get_constraintdef(c.oid) as definition
  from information_schema.table_constraints tc
  join pg_constraint c on c.conname = tc.constraint_name
  join pg_namespace n on n.oid = c.connamespace and n.nspname = tc.table_schema
 where tc.table_schema = 'public'
   and tc.table_name in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
 order by tc.table_name, tc.constraint_type;

-- 3. Índices
select tablename, indexname, indexdef from pg_indexes
 where schemaname = 'public'
   and tablename in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
 order by tablename, indexname;

-- 4. Políticas RLS e estado do RLS
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname in ('public', 'storage') order by schemaname, tablename, policyname;
select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' order by relname;

-- 5. Privilégios dos papéis da API nas tabelas do hub
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
   and table_name in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
 group by table_name, grantee order by table_name, grantee;

-- 6. Funções (security definer, search_path) dos schemas public e private
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private') order by 1, 2;

-- 7. Gatilhos em auth.users e nas tabelas do hub (inclui os de outras aplicações, ex.: contcheck)
select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
  from information_schema.triggers
 where event_object_schema in ('auth', 'public')
 order by event_object_schema, event_object_table, trigger_name;

-- 8. Provedores de identidade e formato de identity_data do Azure (somente CHAVES, sem valores)
select provider, count(*) as identidades from auth.identities group by provider order by provider;
select distinct jsonb_object_keys(identity_data) as chave from auth.identities where provider = 'azure' order by 1;
select distinct jsonb_object_keys(identity_data -> 'custom_claims') as chave_custom_claims
  from auth.identities where provider = 'azure' and jsonb_typeof(identity_data -> 'custom_claims') = 'object' order by 1;

-- 9. Contagens para conferência antes/depois (sem dados pessoais)
select 'dpto' as tabela, count(*) from public.dpto
union all select 'users', count(*) from public.users
union all select 'users_sem_auth', count(*) from public.users where auth_user_id is null
union all select 'users_admin', count(*) from public.users where is_admin
union all select 'applications', count(*) from public.applications
union all select 'applications_ativas', count(*) from public.applications where app_status
union all select 'applications_sem_vinculo', count(*) from public.applications a where not exists (select 1 from public.applications_dpto d where d.app_id = a.app_id)
union all select 'applications_dpto', count(*) from public.applications_dpto
union all select 'access_log', count(*) from public.access_log
union all select 'patch_notes', count(*) from public.patch_notes
union all select 'users_email_maiusculo', count(*) from public.users where user_email <> lower(user_email)
union all select 'auth_users', count(*) from auth.users;

-- 10. Origens de app_url cadastradas (para montar LUZIA_APP_ALLOWED_ORIGINS) e URLs não-https
select regexp_replace(app_url, '^(https?://[^/]+).*$', '\1') as origem, count(*), bool_or(app_status) as alguma_ativa
  from public.applications group by 1 order by 1;

-- 11. Bucket de ícones
select id, name, public from storage.buckets where id = 'app-icons';

-- 12. Versão do Postgres (a migração foi ensaiada em PGlite/Postgres 18)
select version();
