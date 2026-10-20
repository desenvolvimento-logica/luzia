-- Reversão de 20261020100000_luzia_foundation: remove SOMENTE objetos luzia_ e private.luzia_*.
--
-- Permitida apenas na fase coexistence, quando as tabelas luzia_ são cópia do legado. Apaga também o que só
-- existe nelas (eventos de acesso e novidades criados pelo hub novo, auditoria e estado de acesso): por isso
-- exige confirmação explícita na mesma transação:
--
--   begin;
--   set local luzia.confirm_drop = 'remover-objetos-luzia';
--   \i ...este arquivo...   (no SQL Editor: colar o conteúdo abaixo do set local)
--   commit;
--
-- Não toca em public.users, public.dpto, auth.* nem em objetos de outros sistemas.

do $$
begin
  if current_setting('luzia.confirm_drop', true) is distinct from 'remover-objetos-luzia' then
    raise exception 'luzia: confirmação ausente (set local luzia.confirm_drop = ''remover-objetos-luzia'')';
  end if;
  if to_regclass('public.luzia_settings') is not null
     and coalesce((select value from public.luzia_settings where key = 'phase'), 'coexistence') <> 'coexistence' then
    raise exception 'luzia: fase primary ativa; reverta o corte antes (o hub novo é a fonte da verdade)';
  end if;
end
$$;

-- Políticas primeiro (dependem das funções auxiliares), depois funções, tabelas e tipos.
do $$
declare
  r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'luzia\_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

drop function if exists public.luzia_report_access_metrics(date, date, uuid, bigint, bigint);
drop function if exists public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int, text, text);
drop function if exists public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int);
drop function if exists public.luzia_report_application_names();
drop function if exists public.luzia_report_scope();
drop function if exists public.luzia_admin_adopt_legacy_collaborators();
drop function if exists public.luzia_admin_save_news(uuid, text, text, text, timestamptz);
drop function if exists public.luzia_admin_save_application(uuid, text, text, text, text, boolean, text, bigint[]);
drop function if exists public.luzia_admin_change_identity(bigint, uuid, text, text);
drop function if exists public.luzia_admin_update_collaborator(bigint, bigint, text, boolean, text);
drop function if exists public.luzia_admin_set_department_active(bigint, boolean);
drop function if exists public.luzia_admin_save_department(bigint, text);
drop function if exists public.luzia_register_open(uuid, uuid);
drop function if exists public.luzia_can_open(uuid);
drop function if exists public.luzia_my_profile();
drop function if exists public.luzia_provision_me();

drop function if exists private.luzia_require_admin_write();
drop function if exists private.luzia_report_bounds(date, date);
drop function if exists private.luzia_application_names();
drop function if exists private.luzia_can_open_application(uuid);
drop function if exists private.luzia_visible_collaborator_ids();
drop function if exists private.luzia_can_see_reports();
drop function if exists private.luzia_is_admin();
drop function if exists private.luzia_current_collaborator_id();
drop function if exists private.luzia_me();
drop function if exists private.luzia_phase();
drop function if exists private.luzia_auth_uid();
drop function if exists private.luzia_session_is_microsoft();

-- Tabelas na ordem inversa das FKs (todas internas ao luzia_; sem CASCADE).
drop table if exists public.luzia_audit_events;
drop table if exists public.luzia_access_events;
drop table if exists public.luzia_news;
drop table if exists public.luzia_application_departments;
drop table if exists public.luzia_applications;
drop table if exists public.luzia_collaborators;
drop table if exists public.luzia_departments;
drop table if exists public.luzia_settings;

drop function if exists private.luzia_import_legacy();
drop function if exists private.luzia_collaborators_mirror_after();
drop function if exists private.luzia_collaborators_mirror_before();
drop function if exists private.luzia_departments_mirror_after();
drop function if exists private.luzia_departments_mirror_before();
drop function if exists private.luzia_audit_row();
drop function if exists private.luzia_check_audience();
drop function if exists private.luzia_collaborators_guard();
drop function if exists private.luzia_departments_guard();
drop function if exists private.luzia_reject_update();
drop function if exists private.luzia_reject_delete();
drop function if exists private.luzia_set_updated_at();

drop type if exists public.luzia_audience;
drop type if exists public.luzia_department_kind;
drop type if exists public.luzia_access_status;
drop type if exists public.luzia_hierarchy_role;
