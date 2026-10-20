-- INVENTÁRIO SOMENTE LEITURA do projeto compartilhado (docs/transicao.md, passo 1).
-- Uma única consulta que devolve UMA célula JSON: copie o conteúdo da célula e envie.
-- Lê só catálogos do Postgres, contagens e nomes de chaves; nenhum nome, e-mail ou outro dado pessoal.
-- Não cria, altera nem apaga nada.

with
hub_tables as (
  select unnest(array['dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes']) as t
)
select jsonb_pretty(jsonb_build_object(
  'gerado_em', now(),
  'versao_postgres', version(),

  -- 1. Colunas e tipos das tabelas do hub
  'colunas_hub', (
    select jsonb_object_agg(c.table_name, c.cols) from (
      select table_name, jsonb_agg(jsonb_build_object(
               'coluna', column_name, 'tipo', data_type, 'nulo', is_nullable, 'padrao', column_default,
               'identity', case when is_identity = 'YES' then identity_generation end)
             order by ordinal_position) as cols
        from information_schema.columns
       where table_schema = 'public' and table_name in (select t from hub_tables)
       group by table_name) c),

  -- 2. Restrições (PK, FK com ação de exclusão, unique, check)
  'restricoes_hub', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', cl.relname, 'nome', con.conname, 'tipo', con.contype, 'definicao', pg_get_constraintdef(con.oid))
           order by cl.relname, con.contype, con.conname), '[]'::jsonb)
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public' and cl.relname in (select t from hub_tables)),

  -- 3. Índices
  'indices_hub', (
    select coalesce(jsonb_agg(jsonb_build_object('tabela', tablename, 'indice', indexname, 'definicao', indexdef)
           order by tablename, indexname), '[]'::jsonb)
      from pg_indexes where schemaname = 'public' and tablename in (select t from hub_tables)),

  -- 4. RLS e políticas das tabelas do hub e do Storage
  'rls_hub', (
    select coalesce(jsonb_object_agg(c.relname, jsonb_build_object('rls', c.relrowsecurity, 'forcado', c.relforcerowsecurity)), '{}'::jsonb)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in (select t from hub_tables)),
  'politicas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'schema', schemaname, 'tabela', tablename, 'politica', policyname, 'permissiva', permissive,
             'papeis', roles, 'comando', cmd, 'using', qual, 'with_check', with_check)
           order by schemaname, tablename, policyname), '[]'::jsonb)
      from pg_policies
     where (schemaname = 'public' and tablename in (select t from hub_tables))
        or (schemaname = 'storage' and tablename = 'objects')),

  -- 5. Privilégios dos papéis da API nas tabelas do hub
  'grants_hub', (
    select coalesce(jsonb_object_agg(g.k, g.privs), '{}'::jsonb) from (
      select table_name || ':' || grantee as k, jsonb_agg(privilege_type order by privilege_type) as privs
        from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
         and table_name in (select t from hub_tables)
       group by table_name, grantee) g),

  -- 6. Funções do hub legado em public e todos os nomes em private (colisões)
  'funcoes_public_hub', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
             'security_definer', p.prosecdef, 'config', p.proconfig)
           order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'current\_user\_%' or p.proname like 'link\_%' or p.proname like 'luzia\_%')),
  'funcoes_private', (
    select coalesce(jsonb_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'),

  -- 7. Gatilhos em auth.users e nas tabelas do hub (inclui os de outros sistemas)
  'gatilhos', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', t.tgrelid::regclass::text, 'gatilho', t.tgname, 'funcao', p.oid::regprocedure::text,
             'habilitado', t.tgenabled <> 'D', 'definicao', pg_get_triggerdef(t.oid))
           order by t.tgrelid::regclass::text, t.tgname), '[]'::jsonb)
      from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where not t.tgisinternal
       and t.tgrelid in (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where (n.nspname = 'auth' and c.relname = 'users')
                             or (n.nspname = 'public' and c.relname in (select t from hub_tables)))),

  -- 8. Provedores de identidade e formato de identity_data do Azure (somente CHAVES, nunca valores)
  'identidades', jsonb_build_object(
    'por_provedor', (select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb)
                       from (select provider, count(*) as n from auth.identities group by provider) x),
    'chaves_identity_data_azure', (select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb)
                                     from auth.identities i, jsonb_object_keys(i.identity_data) k where i.provider = 'azure'),
    'chaves_custom_claims_azure', (select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb)
                                     from auth.identities i, jsonb_object_keys(i.identity_data -> 'custom_claims') k
                                    where i.provider = 'azure' and jsonb_typeof(i.identity_data -> 'custom_claims') = 'object'),
    'quantidade_tids_distintos', (select count(distinct coalesce(i.identity_data ->> 'tid', i.identity_data -> 'custom_claims' ->> 'tid'))
                                    from auth.identities i where i.provider = 'azure')),

  -- 9. Contagens para conferência antes/depois
  'contagens', jsonb_build_object(
    'dpto', (select count(*) from public.dpto),
    'dpto_nao_atribuido', (select count(*) from public.dpto where dpto_name = 'Não atribuído'),
    'users', (select count(*) from public.users),
    'users_sem_auth', (select count(*) from public.users where auth_user_id is null),
    'users_sem_dpto', (select count(*) from public.users where user_dpto is null),
    'users_admin', (select count(*) from public.users where is_admin),
    'users_email_maiusculo', (select count(*) from public.users where user_email <> lower(user_email)),
    'users_email_repetido_ignorando_maiusculas', (select count(*) from (select 1 from public.users group by lower(btrim(user_email)) having count(*) > 1) x),
    'users_por_cargo', (select coalesce(jsonb_object_agg(coalesce(user_role, 'nulo'), n), '{}'::jsonb)
                          from (select user_role, count(*) as n from public.users group by user_role) x),
    'applications', (select count(*) from public.applications),
    'applications_ativas', (select count(*) from public.applications where app_status),
    'applications_sem_vinculo', (select count(*) from public.applications a where not exists (select 1 from public.applications_dpto d where d.app_id = a.app_id)),
    'applications_dpto', (select count(*) from public.applications_dpto),
    'access_log', (select count(*) from public.access_log),
    'patch_notes', (select count(*) from public.patch_notes),
    'auth_users', (select count(*) from auth.users)),

  -- 10. Origens de app_url (para LUZIA_APP_ALLOWED_ORIGINS)
  'origens_app_url', (
    select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'apps', n, 'alguma_ativa', ativa) order by origem), '[]'::jsonb)
      from (select regexp_replace(app_url, '^(https?://[^/]+).*$', '\1') as origem, count(*) as n, bool_or(app_status) as ativa
              from public.applications group by 1) x),

  -- 11. Bucket de ícones
  'bucket_app_icons', (select to_jsonb(b) from (select id, name, public from storage.buckets where id = 'app-icons') b),

  -- 13. Dependências de outros sistemas nas tabelas do hub (FKs que o espelho precisa preservar)
  'fks_de_outros_sistemas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela_dependente', c.conrelid::regclass::text, 'restricao', c.conname, 'referencia', c.confrelid::regclass::text,
             'on_delete', case c.confdeltype when 'c' then 'cascade' when 'r' then 'restrict' when 'a' then 'no action'
                                             when 'n' then 'set null' when 'd' then 'set default' end)
           order by c.confrelid::regclass::text, c.conrelid::regclass::text), '[]'::jsonb)
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid in (select cl.oid from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
                            where n.nspname = 'public' and cl.relname in (select t from hub_tables))
       and c.conrelid not in (select cl.oid from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
                               where n.nspname = 'public' and cl.relname in (select t from hub_tables))),

  -- 14. Objetos luzia_ já existentes (antes da primeira aplicação devem ser zero)
  'objetos_luzia_existentes', (
    select coalesce(jsonb_agg(x.nome order by x.nome), '[]'::jsonb) from (
      select 'relacao:' || n.nspname || '.' || c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname like 'luzia\_%'
      union all select 'funcao:' || n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'luzia\_%'
      union all select 'tipo:' || n.nspname || '.' || t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname like 'luzia\_%' and t.typtype = 'e'
    ) x),

  -- 15. Schema private (a migração exige USAGE para authenticated e não altera o schema)
  'schema_private', (
    select jsonb_build_object('existe', true, 'dono', pg_get_userbyid(n.nspowner),
                              'authenticated_usage', has_schema_privilege('authenticated', n.nspname, 'USAGE'))
      from pg_namespace n where n.nspname = 'private')
)) as inventario;
