-- VERIFICAÇÃO SOMENTE LEITURA da fundação luzia_ (executar no SQL Editor depois de aplicar e importar).
-- Retorna uma célula JSON. Não lê dados pessoais: só contagens, nomes de objetos e flags.

select jsonb_pretty(jsonb_build_object(
  'fase', (select value from public.luzia_settings where key = 'phase'),
  'tenant_configurado', exists (select 1 from public.luzia_settings where key = 'azure_tenant_id' and value <> ''),
  'contagens', jsonb_build_object(
    'luzia_departments', (select count(*) from public.luzia_departments),
    'dpto_legado', (select count(*) from public.dpto),
    'luzia_collaborators', (select count(*) from public.luzia_collaborators),
    'users_legado', (select count(*) from public.users),
    'luzia_applications', (select count(*) from public.luzia_applications),
    'applications_legado', (select count(*) from public.applications),
    'luzia_application_departments', (select count(*) from public.luzia_application_departments),
    'applications_dpto_legado', (select count(*) from public.applications_dpto)),
  'divergencias', jsonb_build_object(
    'colaboradores_ausentes_no_luzia', (select count(*) from public.users u where not exists (select 1 from public.luzia_collaborators c where c.id = u.user_id)),
    'colaboradores_com_dados_diferentes', (select count(*) from public.users u join public.luzia_collaborators c on c.id = u.user_id
        where (u.auth_user_id, lower(btrim(u.user_email)), u.user_role, coalesce(u.is_admin, false))
              is distinct from (c.auth_user_id, c.email, c.role::text, c.is_admin)),
    'departamentos_com_nome_diferente', (select count(*) from public.dpto d join public.luzia_departments l on l.id = d.dpto_id where btrim(d.dpto_name) <> l.name),
    'administradores_ativos_luzia', (select count(*) from public.luzia_collaborators where is_admin and access_status = 'active')),
  'rls_desligado', (select coalesce(jsonb_agg(c.relname), '[]'::jsonb) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'luzia\_%' and not c.relrowsecurity),
  'escrita_direta_concedida', (select coalesce(jsonb_agg(distinct g.table_name || ':' || g.grantee || ':' || g.privilege_type), '[]'::jsonb)
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name like 'luzia\_%' and g.grantee in ('anon', 'authenticated')
        and g.privilege_type <> 'SELECT'),
  'leitura_anon', (select coalesce(jsonb_agg(distinct g.table_name), '[]'::jsonb) from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name like 'luzia\_%' and g.grantee = 'anon'),
  'funcoes_definer_sem_search_path', (select coalesce(jsonb_agg(n.nspname || '.' || p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.proname like 'luzia\_%' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'objetos_em_tabelas_compartilhadas', (select coalesce(jsonb_agg(t.tgname), '[]'::jsonb) from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid in ('public.users'::regclass, 'public.dpto'::regclass, 'auth.users'::regclass) and p.proname like 'luzia\_%')
)) as verificacao;
