-- IMPRESSÃO DIGITAL SOMENTE LEITURA das tabelas legadas do hub e dos objetos que outros sistemas usam.
-- Rodar ANTES e DEPOIS de aplicar a fundação luzia_ (e da importação): na fase coexistence os valores devem
-- ser idênticos. Devolve uma célula JSON com contagens e hashes md5 (nenhum dado legível).

select jsonb_pretty(jsonb_build_object(
  'gerado_em', now(),
  'dados', jsonb_build_object(
    'dpto', jsonb_build_object('linhas', (select count(*) from public.dpto),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.dpto_id), '')) from public.dpto t)),
    'users', jsonb_build_object('linhas', (select count(*) from public.users),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.user_id), '')) from public.users t)),
    'applications', jsonb_build_object('linhas', (select count(*) from public.applications),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.app_id), '')) from public.applications t)),
    'applications_dpto', jsonb_build_object('linhas', (select count(*) from public.applications_dpto),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.app_id, t.dpto_id), '')) from public.applications_dpto t)),
    'access_log', jsonb_build_object('linhas', (select count(*) from public.access_log),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.log_id), '')) from public.access_log t)),
    'patch_notes', jsonb_build_object('linhas', (select count(*) from public.patch_notes),
      'md5', (select md5(coalesce(string_agg(t::text, '|' order by t.note_id), '')) from public.patch_notes t)),
    'auth_users', jsonb_build_object('linhas', (select count(*) from auth.users))),
  'estrutura', jsonb_build_object(
    'politicas', (select md5(coalesce(string_agg(schemaname || '.' || tablename || '.' || policyname || coalesce(qual, '') || coalesce(with_check, ''), '|'
                    order by schemaname, tablename, policyname), ''))
                    from pg_policies where tablename not like 'luzia\_%'),
    'gatilhos', (select md5(coalesce(string_agg(tgrelid::regclass::text || '.' || tgname || tgenabled::text, '|' order by tgrelid::regclass::text, tgname), ''))
                   from pg_trigger where not tgisinternal and tgrelid::regclass::text not like '%luzia\_%'),
    'grants', (select md5(coalesce(string_agg(table_schema || '.' || table_name || grantee || privilege_type, '|'
                 order by table_schema, table_name, grantee, privilege_type), ''))
                 from information_schema.role_table_grants
                where table_schema in ('public', 'auth') and table_name not like 'luzia\_%'),
    'funcoes_fora_luzia', (select md5(coalesce(string_agg(n.nspname || '.' || p.proname || pg_get_function_identity_arguments(p.oid) || md5(p.prosrc), '|'
                             order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), ''))
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname in ('public', 'private') and p.proname not like 'luzia\_%'),
    'schema_private_acl', (select coalesce(nspacl::text, '') from pg_namespace where nspname = 'private'))
)) as impressao_digital;
