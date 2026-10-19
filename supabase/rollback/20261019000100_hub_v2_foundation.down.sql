-- Reversão de 20261019000100_hub_v2_foundation — compatível com os dados.
--
-- Restaura políticas e privilégios anteriores (de private.policy_backup / private.grant_backup) e remove
-- gatilhos e funções da v2. NÃO remove colunas novas (access_status, audience, open_id, dpto_kind),
-- nem public.admin_audit, nem os backups: esses dados continuam disponíveis para uma nova tentativa
-- ou investigação. O hub antigo ignora as colunas extras.
--
-- Depois de executar: reverter também o frontend e as origens aceitas pelas aplicações (spec 12).
-- Ensaiada apenas em PGlite (tests/db/migration-rehearsal.test.ts).

do $$
declare
  r record;
  v_sql text;
begin
  if not exists (select 1 from private.policy_backup where migration = '20261019000100') then
    raise exception 'Sem backup de políticas da migração 20261019000100; reversão abortada.';
  end if;

  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes', 'admin_audit')
       and policyname like 'luzia\_%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in select * from private.policy_backup where migration = '20261019000100' order by tablename, policyname loop
    v_sql := format(
      'create policy %I on public.%I as %s for %s to %s',
      r.policyname, r.tablename, lower(r.permissive), lower(r.cmd),
      (select string_agg(quote_ident(x), ', ') from unnest(r.roles) x)
    );
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)', r.qual);
    end if;
    if r.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', r.with_check);
    end if;
    execute v_sql;
  end loop;

  for r in select * from private.grant_backup where migration = '20261019000100' loop
    execute format('grant %s on public.%I to %I', r.privilege_type, r.table_name, r.grantee);
  end loop;
end
$$;

drop trigger if exists luzia_users_guard on public.users;
drop trigger if exists luzia_dpto_guard on public.dpto;
drop trigger if exists luzia_applications_guard on public.applications;
drop trigger if exists luzia_app_audience_check on public.applications;
drop trigger if exists luzia_app_dpto_audience_check on public.applications_dpto;
drop trigger if exists luzia_audit on public.dpto;
drop trigger if exists luzia_audit on public.users;
drop trigger if exists luzia_audit on public.applications;
drop trigger if exists luzia_audit on public.applications_dpto;
drop trigger if exists luzia_audit on public.patch_notes;

-- A restrição de URL não é necessária ao legado; a audiência deixa de ser exigida pelo hub antigo.
alter table public.applications drop constraint if exists applications_app_url_safe_check;
alter table public.applications alter column audience drop not null;
alter table public.applications alter column audience drop default;

drop function if exists public.report_access_metrics(date, date, bigint, bigint, bigint);
drop function if exists public.report_access_page(date, date, bigint, bigint, bigint, int, int);
drop function if exists public.report_scope_users();
drop function if exists public.report_app_names();
drop function if exists public.admin_change_identity(bigint, uuid, text, text);
drop function if exists public.admin_save_application(bigint, text, text, text, text, boolean, text, bigint[]);
drop function if exists public.luzia_can_open(bigint);
drop function if exists public.luzia_register_open(bigint, uuid);
drop function if exists public.luzia_provision_me();
drop function if exists private.report_bounds(date, date);
drop function if exists private.audit_row();
drop function if exists private.check_app_audience();
drop function if exists private.applications_guard();
drop function if exists private.dpto_guard();
drop function if exists private.users_guard();
drop function if exists private.app_names();
drop function if exists private.can_open_app(bigint);
drop function if exists private.visible_user_ids();
drop function if exists private.can_see_reports();
drop function if exists private.is_admin();
drop function if exists private.current_user_id();
drop function if exists private.me();
