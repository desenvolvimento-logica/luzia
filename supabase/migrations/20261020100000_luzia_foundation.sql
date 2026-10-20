-- Luz.IA — fundação das tabelas luzia_ no projeto Supabase compartilhado.
--
-- Regras do projeto compartilhado (HelpDesk GC docs/environment-decisions.md, LG docs/DATABASE.md):
--   * só cria/altera objetos com prefixo luzia_ em public e funções private.luzia_*;
--   * não cria colunas, gatilhos, políticas nem substitui funções em auth.users, public.users, public.dpto
--     ou em qualquer objeto de outro sistema; não altera privilégios do schema private;
--   * aplicada manualmente no SQL Editor, com aprovação, nunca por `supabase db push`.
--
-- Fases (luzia_settings.phase):
--   coexistence — as tabelas luzia_ são cópia do legado (private.luzia_import_legacy()); administração somente
--                 leitura no hub novo; nada é escrito nas tabelas legadas.
--   primary     — as tabelas luzia_ são a fonte da verdade e departamentos/colaboradores são espelhados para
--                 public.dpto/public.users (mesmos IDs) para o HelpDesk GC e o lic_ continuarem funcionando.
--                 Ativada por supabase/cutover/20261020110000_luzia_switch_to_primary.sql.
--
-- Idempotente. Ensaiada apenas em PGlite sobre o legado hipotético (tests/db). Reversão:
-- supabase/rollback/20261020100000_luzia_foundation.down.sql (somente na fase coexistence).

begin;

-- ---------------------------------------------------------------------------
-- 0. Verificações prévias (abortam sem alterar nada)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('private') is null or not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'luzia: schema private ausente ou sem USAGE para authenticated';
  end if;
  if to_regclass('public.users') is null or to_regclass('public.dpto') is null then
    raise exception 'luzia: tabelas legadas public.users/public.dpto não encontradas';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'users'
         and column_name in ('user_id', 'auth_user_id', 'user_name', 'user_email', 'user_dpto', 'user_role', 'is_admin', 'user_create')) <> 8 then
    raise exception 'luzia: public.users não tem as colunas esperadas (o espelho grava user_id..is_admin e user_create)';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'dpto' and column_name in ('dpto_id', 'dpto_name', 'user_create')) <> 3 then
    raise exception 'luzia: public.dpto não tem as colunas esperadas (dpto_id, dpto_name, user_create)';
  end if;
  if exists (select 1 from public.users where auth_user_id is not null group by auth_user_id having count(*) > 1) then
    raise exception 'luzia: public.users tem auth_user_id duplicado';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'luzia_hierarchy_role') then
    create type public.luzia_hierarchy_role as enum ('usuario', 'lider', 'coordenador', 'gerente', 'diretor');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'luzia_access_status') then
    create type public.luzia_access_status as enum ('active', 'inactive');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'luzia_department_kind') then
    create type public.luzia_department_kind as enum ('regular', 'provisioning');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'luzia_audience') then
    create type public.luzia_audience as enum ('all_departments', 'selected_departments');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.luzia_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.luzia_settings (key, value) values ('phase', 'coexistence') on conflict (key) do nothing;

-- id = public.dpto.dpto_id (mesmo valor, para o espelho e para as FKs do HelpDesk GC).
create table if not exists public.luzia_departments (
  id bigint primary key,
  name text not null,
  kind public.luzia_department_kind not null default 'regular',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint luzia_departments_name_unique unique (name),
  constraint luzia_departments_name_length_check check (char_length(btrim(name)) between 1 and 80),
  constraint luzia_departments_provisioning_active_check check (kind = 'regular' or active)
);
create unique index if not exists luzia_departments_single_provisioning_idx on public.luzia_departments (kind) where kind = 'provisioning';

-- id = public.users.user_id (mesmo valor, para o espelho e para gestao_cadastros_* / lic_profiles).
create table if not exists public.luzia_collaborators (
  id bigint primary key,
  auth_user_id uuid references auth.users (id) on delete restrict,
  name text not null,
  email text not null,
  department_id bigint not null references public.luzia_departments (id) on delete restrict,
  role public.luzia_hierarchy_role not null default 'usuario',
  is_admin boolean not null default false,
  access_status public.luzia_access_status not null default 'active',
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint luzia_collaborators_auth_user_unique unique (auth_user_id),
  constraint luzia_collaborators_email_unique unique (email),
  constraint luzia_collaborators_email_normalized_check check (email = lower(btrim(email)) and email like '%_@_%'),
  constraint luzia_collaborators_name_length_check check (char_length(btrim(name)) between 1 and 200)
);
create index if not exists luzia_collaborators_department_idx on public.luzia_collaborators (department_id);

create table if not exists public.luzia_applications (
  id uuid primary key default gen_random_uuid(),
  legacy_app_id bigint,
  name text not null,
  description text,
  url text not null,
  icon text,
  active boolean not null default true,
  audience public.luzia_audience not null default 'selected_departments',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint luzia_applications_legacy_unique unique (legacy_app_id),
  constraint luzia_applications_name_length_check check (char_length(btrim(name)) between 1 and 80),
  constraint luzia_applications_description_length_check check (description is null or char_length(description) <= 280),
  -- Bloqueia esquemas perigosos e credenciais; a lista de origens aprovadas fica na configuração do servidor.
  constraint luzia_applications_url_safe_check check (url ~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'),
  constraint luzia_applications_icon_length_check check (icon is null or char_length(icon) <= 1024)
);

create table if not exists public.luzia_application_departments (
  application_id uuid not null references public.luzia_applications (id) on delete restrict,
  department_id bigint not null references public.luzia_departments (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (application_id, department_id)
);
create index if not exists luzia_application_departments_department_idx on public.luzia_application_departments (department_id);

-- Abertura autorizada pelo hub (não comprova uso dentro da aplicação). Somente inserção.
create table if not exists public.luzia_access_events (
  id bigint generated always as identity primary key,
  open_id uuid not null,
  collaborator_id bigint not null references public.luzia_collaborators (id) on delete restrict,
  application_id uuid not null references public.luzia_applications (id) on delete restrict,
  opened_at timestamptz not null default now(),
  constraint luzia_access_events_open_id_unique unique (open_id)
);
create index if not exists luzia_access_events_opened_idx on public.luzia_access_events (opened_at);
create index if not exists luzia_access_events_collaborator_idx on public.luzia_access_events (collaborator_id, opened_at);
create index if not exists luzia_access_events_application_idx on public.luzia_access_events (application_id, opened_at);

create table if not exists public.luzia_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  version text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint luzia_news_title_length_check check (char_length(btrim(title)) between 1 and 120),
  constraint luzia_news_body_length_check check (char_length(btrim(body)) between 1 and 5000),
  constraint luzia_news_version_length_check check (version is null or char_length(version) <= 20)
);
create index if not exists luzia_news_published_idx on public.luzia_news (published_at desc);

create table if not exists public.luzia_audit_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_auth_id uuid,
  actor_collaborator_id bigint,
  action text not null,
  entity text not null,
  entity_id text not null,
  changes jsonb not null default '{}'::jsonb,
  reason text
);
create index if not exists luzia_audit_events_created_idx on public.luzia_audit_events (created_at desc);
create index if not exists luzia_audit_events_entity_idx on public.luzia_audit_events (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 3. Funções auxiliares (private.luzia_*, SECURITY DEFINER, search_path vazio)
-- ---------------------------------------------------------------------------

-- Sessão Microsoft (mesmo critério do LG: amr oauth + provedor azure no app_metadata).
create or replace function private.luzia_session_is_microsoft()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(auth.jwt() -> 'amr') = 'array'
    and exists (select 1 from jsonb_array_elements(auth.jwt() -> 'amr') as m (entry) where m.entry ->> 'method' = 'oauth')
    and jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'providers') = 'array'
    and (auth.jwt() -> 'app_metadata' -> 'providers') ? 'azure',
    false)
$$;

create or replace function private.luzia_auth_uid()
returns uuid
language sql stable set search_path = ''
as $$ select case when private.luzia_session_is_microsoft() then auth.uid() end $$;

create or replace function private.luzia_phase()
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select s.value from public.luzia_settings s where s.key = 'phase'), 'coexistence') $$;

create or replace function private.luzia_me()
returns public.luzia_collaborators
language sql stable security definer set search_path = ''
as $$
  select c.* from public.luzia_collaborators c
   where c.auth_user_id = (select private.luzia_auth_uid()) and c.access_status = 'active'
$$;

create or replace function private.luzia_current_collaborator_id()
returns bigint
language sql stable security definer set search_path = ''
as $$ select (private.luzia_me()).id $$;

create or replace function private.luzia_is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((private.luzia_me()).is_admin, false) $$;

create or replace function private.luzia_can_see_reports()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(m.is_admin or m.role <> 'usuario', false) from private.luzia_me() m $$;

-- Matriz hierárquica (spec 4 / RN-10). Mantida em sincronia com src/lib/auth/matrix.ts.
create or replace function private.luzia_visible_collaborator_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select c.id
    from public.luzia_collaborators c, private.luzia_me() m
   where m.id is not null
     and (
       m.is_admin
       or m.role in ('gerente', 'diretor')
       or (m.role = 'coordenador' and c.department_id = m.department_id and c.role in ('usuario', 'lider'))
       or (m.role = 'lider' and c.department_id = m.department_id and c.role = 'usuario')
     )
$$;

create or replace function private.luzia_can_open_application(p_application_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select a.active and (
             m.is_admin
             or (
               d.kind = 'regular' and d.active
               and (
                 a.audience = 'all_departments'
                 or exists (select 1 from public.luzia_application_departments ad where ad.application_id = a.id and ad.department_id = m.department_id)
               )
             )
           )
      from public.luzia_applications a
      cross join private.luzia_me() m
      left join public.luzia_departments d on d.id = m.department_id
     where a.id = p_application_id and m.id is not null
  ), false)
$$;

create or replace function private.luzia_application_names()
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$ select a.id, a.name from public.luzia_applications a where private.luzia_can_see_reports() $$;

create or replace function private.luzia_report_bounds(p_from date, p_to date)
returns table (ts_from timestamptz, ts_to timestamptz)
language plpgsql stable set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Período máximo de 367 dias.' using errcode = '22023';
  end if;
  return query select (p_from::timestamp at time zone 'America/Sao_Paulo'), ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
end
$$;

-- Exige administrador ativo na fase primary (na coexistência a administração é feita no hub antigo).
create or replace function private.luzia_require_admin_write()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.luzia_is_admin() then
    raise exception 'Somente administradores.' using errcode = '42501', hint = 'luzia_not_admin';
  end if;
  if private.luzia_phase() <> 'primary' then
    raise exception 'Administração somente leitura durante a coexistência com o hub antigo.' using errcode = '42501', hint = 'luzia_read_only_phase';
  end if;
end
$$;

revoke all on function private.luzia_session_is_microsoft(), private.luzia_auth_uid(), private.luzia_phase(), private.luzia_me(),
  private.luzia_current_collaborator_id(), private.luzia_is_admin(), private.luzia_can_see_reports(),
  private.luzia_visible_collaborator_ids(), private.luzia_can_open_application(uuid), private.luzia_application_names(),
  private.luzia_report_bounds(date, date), private.luzia_require_admin_write() from public, anon;
grant execute on function private.luzia_session_is_microsoft(), private.luzia_auth_uid(), private.luzia_phase(), private.luzia_me(),
  private.luzia_current_collaborator_id(), private.luzia_is_admin(), private.luzia_can_see_reports(),
  private.luzia_visible_collaborator_ids(), private.luzia_can_open_application(uuid), private.luzia_application_names(),
  private.luzia_report_bounds(date, date), private.luzia_require_admin_write() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Gatilhos de integridade
-- ---------------------------------------------------------------------------
create or replace function private.luzia_set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['luzia_departments', 'luzia_collaborators', 'luzia_applications', 'luzia_news', 'luzia_settings'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.luzia_set_updated_at()', t || '_set_updated_at', t);
  end loop;
end
$$;

-- Nunca apagar cadastros (histórico, espelho e FKs de outros sistemas): desativar.
create or replace function private.luzia_reject_delete()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Exclusão não permitida em %; desative o registro.', tg_table_name using errcode = '42501', hint = 'luzia_no_delete';
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['luzia_departments', 'luzia_collaborators', 'luzia_applications', 'luzia_access_events', 'luzia_audit_events'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_reject_delete', t);
    execute format('create trigger %I before delete on public.%I for each row execute function private.luzia_reject_delete()', t || '_reject_delete', t);
  end loop;
end
$$;

create or replace function private.luzia_reject_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Registros de % são somente inserção.', tg_table_name using errcode = '42501';
end
$$;

drop trigger if exists luzia_access_events_reject_update on public.luzia_access_events;
create trigger luzia_access_events_reject_update before update on public.luzia_access_events
  for each row execute function private.luzia_reject_update();
drop trigger if exists luzia_audit_events_reject_update on public.luzia_audit_events;
create trigger luzia_audit_events_reject_update before update on public.luzia_audit_events
  for each row execute function private.luzia_reject_update();

create or replace function private.luzia_departments_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.kind <> new.kind then
    raise exception 'O tipo do departamento não pode ser alterado.' using errcode = '42501';
  end if;
  if old.kind = 'provisioning' and new.name <> old.name and current_setting('luzia.importing', true) is distinct from 'on' then
    raise exception 'O departamento de provisionamento é protegido.' using errcode = 'P0001', hint = 'luzia_protected_department';
  end if;
  if old.active and not new.active
     and exists (select 1 from public.luzia_collaborators c where c.department_id = old.id and c.access_status = 'active') then
    raise exception 'Departamento com colaboradores ativos não pode ser desativado.' using errcode = 'P0001', hint = 'luzia_department_in_use';
  end if;
  return new;
end
$$;

drop trigger if exists luzia_departments_guard on public.luzia_departments;
create trigger luzia_departments_guard before update on public.luzia_departments
  for each row execute function private.luzia_departments_guard();

create or replace function private.luzia_collaborators_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.access_status is distinct from old.access_status then
    new.status_changed_at := now();
  end if;
  if old.is_admin and old.access_status = 'active' and not (new.is_admin and new.access_status = 'active') then
    -- Serializa alterações concorrentes de administradores; a consulta usa snapshot novo após o bloqueio.
    perform pg_advisory_xact_lock(hashtext('luzia:last-active-admin'));
    if not exists (select 1 from public.luzia_collaborators c where c.is_admin and c.access_status = 'active' and c.id <> old.id) then
      raise exception 'Não é possível remover a última conta administrativa ativa.' using errcode = 'P0001', hint = 'luzia_last_admin';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists luzia_collaborators_guard on public.luzia_collaborators;
create trigger luzia_collaborators_guard before update on public.luzia_collaborators
  for each row execute function private.luzia_collaborators_guard();

-- Audiência "selected_departments" exige ao menos um departamento; verificado no fim da transação.
create or replace function private.luzia_check_audience()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_table_name = 'luzia_applications' then
    v_id := (to_jsonb(new) ->> 'id')::uuid;
  else
    v_id := (to_jsonb(old) ->> 'application_id')::uuid;
  end if;
  if exists (
    select 1 from public.luzia_applications a
     where a.id = v_id and a.audience = 'selected_departments'
       and not exists (select 1 from public.luzia_application_departments d where d.application_id = a.id)
  ) then
    raise exception 'Aplicação com audiência "Departamentos selecionados" precisa de ao menos um departamento.'
      using errcode = '23514', hint = 'luzia_audience_empty';
  end if;
  return null;
end
$$;

drop trigger if exists luzia_applications_audience_check on public.luzia_applications;
create constraint trigger luzia_applications_audience_check after insert or update on public.luzia_applications
  deferrable initially deferred for each row execute function private.luzia_check_audience();
drop trigger if exists luzia_application_departments_audience_check on public.luzia_application_departments;
create constraint trigger luzia_application_departments_audience_check after delete or update on public.luzia_application_departments
  deferrable initially deferred for each row execute function private.luzia_check_audience();

-- ---------------------------------------------------------------------------
-- 5. Auditoria administrativa atômica (mesma transação da mutação)
-- ---------------------------------------------------------------------------
create or replace function private.luzia_audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  -- Dados pessoais e carimbos não são copiados em inserções; alterações de nome/e-mail continuam registradas.
  v_skip text[] := array['created_at', 'updated_at', 'name', 'email'];
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'status_changed_at') and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  else
    v_changes := v_row - v_skip;
  end if;

  insert into public.luzia_audit_events (actor_auth_id, actor_collaborator_id, action, entity, entity_id, changes, reason)
  values (
    (select auth.uid()),
    (select c.id from public.luzia_collaborators c where c.auth_user_id = (select auth.uid())),
    lower(tg_op),
    tg_table_name,
    case tg_table_name
      when 'luzia_application_departments' then (v_row ->> 'application_id') || ':' || (v_row ->> 'department_id')
      else v_row ->> 'id'
    end,
    v_changes,
    nullif(current_setting('luzia.audit_reason', true), '')
  );
  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['luzia_departments', 'luzia_collaborators', 'luzia_applications', 'luzia_application_departments', 'luzia_news'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.luzia_audit_row()', t || '_audit', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Espelho luzia → legado (somente na fase primary; nunca apaga linhas legadas)
-- ---------------------------------------------------------------------------
-- Novos IDs vêm das sequências legadas para continuarem iguais nos dois lados.
create or replace function private.luzia_departments_mirror_before()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id is null then
    if private.luzia_phase() <> 'primary' then
      raise exception 'Novos departamentos só na fase primary.' using errcode = '42501', hint = 'luzia_read_only_phase';
    end if;
    insert into public.dpto (dpto_name, user_create) values (new.name, 'luzia') returning dpto_id into new.id;
  end if;
  return new;
end
$$;

create or replace function private.luzia_departments_mirror_after()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.luzia_phase() = 'primary' and tg_op = 'UPDATE' and new.name is distinct from old.name then
    update public.dpto set dpto_name = new.name where dpto_id = new.id;
  end if;
  return null;
end
$$;

drop trigger if exists luzia_departments_mirror_before on public.luzia_departments;
create trigger luzia_departments_mirror_before before insert on public.luzia_departments
  for each row execute function private.luzia_departments_mirror_before();
drop trigger if exists luzia_departments_mirror_after on public.luzia_departments;
create trigger luzia_departments_mirror_after after update on public.luzia_departments
  for each row execute function private.luzia_departments_mirror_after();

create or replace function private.luzia_collaborators_mirror_before()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id is null then
    if private.luzia_phase() <> 'primary' then
      raise exception 'Novos colaboradores só na fase primary.' using errcode = '42501', hint = 'luzia_read_only_phase';
    end if;
    insert into public.users (auth_user_id, user_name, user_email, user_dpto, user_role, is_admin, user_create)
    values (new.auth_user_id, new.name, new.email, new.department_id, new.role::text, new.is_admin, 'luzia')
    returning user_id into new.id;
  end if;
  return new;
end
$$;

create or replace function private.luzia_collaborators_mirror_after()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.luzia_phase() = 'primary' and tg_op = 'UPDATE'
     and (new.auth_user_id, new.name, new.email, new.department_id, new.role, new.is_admin)
         is distinct from (old.auth_user_id, old.name, old.email, old.department_id, old.role, old.is_admin) then
    update public.users
       set auth_user_id = new.auth_user_id, user_name = new.name, user_email = new.email,
           user_dpto = new.department_id, user_role = new.role::text, is_admin = new.is_admin
     where user_id = new.id;
  end if;
  return null;
end
$$;

drop trigger if exists luzia_collaborators_mirror_before on public.luzia_collaborators;
create trigger luzia_collaborators_mirror_before before insert on public.luzia_collaborators
  for each row execute function private.luzia_collaborators_mirror_before();
drop trigger if exists luzia_collaborators_mirror_after on public.luzia_collaborators;
create trigger luzia_collaborators_mirror_after after update on public.luzia_collaborators
  for each row execute function private.luzia_collaborators_mirror_after();

-- ---------------------------------------------------------------------------
-- 7. Importação do legado (somente na fase coexistence; idempotente; só lê tabelas legadas)
-- ---------------------------------------------------------------------------
create or replace function private.luzia_import_legacy()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_provisioning bigint;
  v_before jsonb;
  v_result jsonb;
begin
  if private.luzia_phase() <> 'coexistence' then
    raise exception 'Importação do legado só na fase coexistence (depois do corte o hub novo é a fonte).' using errcode = '42501';
  end if;
  if exists (select 1 from public.users group by lower(btrim(user_email)) having count(*) > 1) then
    raise exception 'public.users tem e-mails repetidos ignorando maiúsculas; corrija antes de importar.' using errcode = '23505';
  end if;
  select d.dpto_id into v_provisioning from public.dpto d where d.dpto_name = 'Não atribuído';
  if v_provisioning is null then
    raise exception 'Departamento legado "Não atribuído" não encontrado.' using errcode = 'P0002';
  end if;

  v_before := jsonb_build_object(
    'departments', (select count(*) from public.luzia_departments),
    'collaborators', (select count(*) from public.luzia_collaborators),
    'applications', (select count(*) from public.luzia_applications));

  perform set_config('luzia.importing', 'on', true);
  perform set_config('luzia.audit_reason', 'importacao-legado', true);

  insert into public.luzia_departments (id, name, kind)
  select d.dpto_id, btrim(d.dpto_name), case when d.dpto_id = v_provisioning then 'provisioning' else 'regular' end::public.luzia_department_kind
    from public.dpto d
  on conflict (id) do update set name = excluded.name;

  insert into public.luzia_collaborators (id, auth_user_id, name, email, department_id, role, is_admin)
  select u.user_id, u.auth_user_id, btrim(u.user_name), lower(btrim(u.user_email)),
         coalesce(u.user_dpto, v_provisioning), u.user_role::public.luzia_hierarchy_role, coalesce(u.is_admin, false)
    from public.users u
  on conflict (id) do update
     set auth_user_id = excluded.auth_user_id, name = excluded.name, email = excluded.email,
         department_id = excluded.department_id, role = excluded.role, is_admin = excluded.is_admin;

  insert into public.luzia_applications (legacy_app_id, name, description, url, icon, active, audience)
  select a.app_id, btrim(a.app_name), nullif(btrim(a.app_description), ''), btrim(a.app_url), nullif(btrim(a.app_icon), ''), a.app_status,
         case when exists (select 1 from public.applications_dpto ad where ad.app_id = a.app_id)
              then 'selected_departments' else 'all_departments' end::public.luzia_audience
    from public.applications a
  on conflict (legacy_app_id) do update
     set name = excluded.name, description = excluded.description, url = excluded.url, icon = excluded.icon,
         active = excluded.active, audience = excluded.audience;

  -- Vínculos: adiciona os do legado e remove os que deixaram de existir lá (só para apps vindas do legado).
  insert into public.luzia_application_departments (application_id, department_id)
  select la.id, ad.dpto_id
    from public.applications_dpto ad join public.luzia_applications la on la.legacy_app_id = ad.app_id
  on conflict do nothing;
  delete from public.luzia_application_departments lad
   using public.luzia_applications la
   where la.id = lad.application_id and la.legacy_app_id is not null
     and not exists (select 1 from public.applications_dpto ad where ad.app_id = la.legacy_app_id and ad.dpto_id = lad.department_id);

  perform set_config('luzia.importing', '', true);
  perform set_config('luzia.audit_reason', '', true);

  v_result := jsonb_build_object(
    'antes', v_before,
    'depois', jsonb_build_object(
      'departments', (select count(*) from public.luzia_departments),
      'collaborators', (select count(*) from public.luzia_collaborators),
      'applications', (select count(*) from public.luzia_applications),
      'application_departments', (select count(*) from public.luzia_application_departments)),
    'legado', jsonb_build_object(
      'dpto', (select count(*) from public.dpto),
      'users', (select count(*) from public.users),
      'applications', (select count(*) from public.applications),
      'applications_dpto', (select count(*) from public.applications_dpto)),
    'somente_no_luzia', jsonb_build_object(
      'collaborators', (select count(*) from public.luzia_collaborators c where not exists (select 1 from public.users u where u.user_id = c.id)),
      'departments', (select count(*) from public.luzia_departments d where not exists (select 1 from public.dpto x where x.dpto_id = d.id))));
  return v_result;
end
$$;
revoke all on function private.luzia_import_legacy() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. RLS e privilégios: clientes só leem; toda escrita passa por RPC
-- ---------------------------------------------------------------------------
alter table public.luzia_settings enable row level security;
alter table public.luzia_departments enable row level security;
alter table public.luzia_collaborators enable row level security;
alter table public.luzia_applications enable row level security;
alter table public.luzia_application_departments enable row level security;
alter table public.luzia_access_events enable row level security;
alter table public.luzia_news enable row level security;
alter table public.luzia_audit_events enable row level security;

revoke all on public.luzia_settings, public.luzia_departments, public.luzia_collaborators, public.luzia_applications,
  public.luzia_application_departments, public.luzia_access_events, public.luzia_news, public.luzia_audit_events
  from anon, authenticated;
grant select on public.luzia_departments, public.luzia_collaborators, public.luzia_applications,
  public.luzia_application_departments, public.luzia_access_events, public.luzia_news, public.luzia_audit_events
  to authenticated;

drop policy if exists luzia_departments_select on public.luzia_departments;
create policy luzia_departments_select on public.luzia_departments for select to authenticated
  using ((select private.luzia_current_collaborator_id()) is not null);

-- O próprio registro (mesmo inativo, para a interface explicar o estado) + escopo da matriz.
drop policy if exists luzia_collaborators_select on public.luzia_collaborators;
create policy luzia_collaborators_select on public.luzia_collaborators for select to authenticated
  using (auth_user_id = (select private.luzia_auth_uid()) or id in (select private.luzia_visible_collaborator_ids()));

drop policy if exists luzia_applications_select on public.luzia_applications;
create policy luzia_applications_select on public.luzia_applications for select to authenticated
  using ((select private.luzia_is_admin()) or private.luzia_can_open_application(id));

drop policy if exists luzia_application_departments_select on public.luzia_application_departments;
create policy luzia_application_departments_select on public.luzia_application_departments for select to authenticated
  using ((select private.luzia_current_collaborator_id()) is not null);

drop policy if exists luzia_access_events_select on public.luzia_access_events;
create policy luzia_access_events_select on public.luzia_access_events for select to authenticated
  using ((select private.luzia_can_see_reports()) and collaborator_id in (select private.luzia_visible_collaborator_ids()));

drop policy if exists luzia_news_select on public.luzia_news;
create policy luzia_news_select on public.luzia_news for select to authenticated
  using ((select private.luzia_current_collaborator_id()) is not null and (published_at <= now() or (select private.luzia_is_admin())));

drop policy if exists luzia_audit_events_select on public.luzia_audit_events;
create policy luzia_audit_events_select on public.luzia_audit_events for select to authenticated
  using ((select private.luzia_is_admin()));

-- ---------------------------------------------------------------------------
-- 9. RPCs expostas ao hub (public.luzia_*)
-- ---------------------------------------------------------------------------

-- Valida sessão Microsoft + tenant e vincula/adota/provisiona o colaborador.
-- O caminho do tid em identity_data precisa ser confirmado no projeto real (docs/decisoes.md X-03).
create or replace function public.luzia_provision_me()
returns table (collaborator_id bigint, access_status text, outcome text)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_tenant text;
  v_email text;
  v_name text;
  v_phase text := private.luzia_phase();
  v_c public.luzia_collaborators;
  v_u record;
  v_provisioning bigint;
begin
  if v_uid is null then
    raise exception 'Sessão ausente.' using errcode = '28000', hint = 'luzia_no_session';
  end if;
  if not private.luzia_session_is_microsoft() then
    raise exception 'Sessão não é Microsoft.' using errcode = '28000', hint = 'luzia_foreign_account';
  end if;
  select s.value into v_tenant from public.luzia_settings s where s.key = 'azure_tenant_id';
  if coalesce(v_tenant, '') = '' then
    raise exception 'Tenant corporativo não configurado.' using errcode = '28000', hint = 'luzia_tenant_not_configured';
  end if;
  if not exists (
    select 1 from auth.identities i
     where i.user_id = v_uid and i.provider = 'azure'
       and lower(coalesce(i.identity_data ->> 'tid', i.identity_data -> 'custom_claims' ->> 'tid', '')) = lower(v_tenant)
  ) then
    raise exception 'Conta não pertence ao tenant corporativo.' using errcode = '28000', hint = 'luzia_foreign_account';
  end if;

  -- 1) já vinculado no luzia
  select c.* into v_c from public.luzia_collaborators c where c.auth_user_id = v_uid;
  if found then
    return query select v_c.id, v_c.access_status::text, 'existente';
    return;
  end if;

  select lower(btrim(au.email)),
         coalesce(nullif(au.raw_user_meta_data ->> 'full_name', ''), nullif(au.raw_user_meta_data ->> 'name', ''), split_part(au.email, '@', 1))
    into v_email, v_name
    from auth.users au where au.id = v_uid;
  if coalesce(v_email, '') = '' then
    raise exception 'Conta sem e-mail.' using errcode = '28000', hint = 'luzia_no_email';
  end if;

  -- 2) cadastro luzia com o mesmo e-mail ainda sem identidade (só na fase primary; e-mail nunca reassocia)
  select c.* into v_c from public.luzia_collaborators c where c.email = v_email for update;
  if found then
    if v_c.auth_user_id is not null then
      raise exception 'Cadastro já vinculado a outra identidade.' using errcode = '28000', hint = 'luzia_identity_conflict';
    end if;
    if v_phase <> 'primary' then
      raise exception 'Cadastro ainda não sincronizado com o hub antigo.' using errcode = '28000', hint = 'luzia_not_synced';
    end if;
    perform set_config('luzia.audit_reason', 'vinculo-primeiro-acesso', true);
    update public.luzia_collaborators c set auth_user_id = v_uid where c.id = v_c.id;
    perform set_config('luzia.audit_reason', '', true);
    return query select v_c.id, v_c.access_status::text, 'vinculado';
    return;
  end if;

  -- 3) cadastro legado já vinculado a esta identidade (ex.: criado pelo gatilho legado): adotar com o mesmo id
  select u.user_id, u.user_name, u.user_dpto, u.user_role, u.is_admin into v_u
    from public.users u where u.auth_user_id = v_uid;
  if found then
    select d.id into v_provisioning from public.luzia_departments d where d.kind = 'provisioning';
    perform set_config('luzia.audit_reason', 'adocao-cadastro-legado', true);
    insert into public.luzia_collaborators (id, auth_user_id, name, email, department_id, role, is_admin)
    values (v_u.user_id, v_uid, coalesce(nullif(btrim(v_u.user_name), ''), v_name), v_email,
            coalesce((select d.id from public.luzia_departments d where d.id = v_u.user_dpto), v_provisioning),
            v_u.user_role::public.luzia_hierarchy_role, coalesce(v_u.is_admin, false))
    on conflict (id) do nothing;
    perform set_config('luzia.audit_reason', '', true);
    return query select c.id, c.access_status::text, 'adotado' from public.luzia_collaborators c where c.auth_user_id = v_uid;
    return;
  end if;

  -- 4) ninguém: na coexistência o cadastro nasce no hub antigo; na fase primary o hub novo provisiona
  if v_phase <> 'primary' then
    raise exception 'Cadastro ainda não sincronizado com o hub antigo.' using errcode = '28000', hint = 'luzia_not_synced';
  end if;
  select d.id into v_provisioning from public.luzia_departments d where d.kind = 'provisioning';
  perform set_config('luzia.audit_reason', 'provisionamento-primeiro-acesso', true);
  begin
    insert into public.luzia_collaborators (auth_user_id, name, email, department_id, role, is_admin)
    values (v_uid, v_name, v_email, v_provisioning, 'usuario', false);
  exception when unique_violation then
    null; -- requisição concorrente do mesmo colaborador
  end;
  perform set_config('luzia.audit_reason', '', true);
  return query select c.id, c.access_status::text, 'provisionado' from public.luzia_collaborators c where c.auth_user_id = v_uid;
end
$$;

-- Perfil do próprio colaborador (inclui estado e departamento, mesmo inativo).
create or replace function public.luzia_my_profile()
returns table (
  collaborator_id bigint, name text, email text, role text, is_admin boolean, access_status text,
  department_id bigint, department_name text, department_kind text, phase text
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.email, c.role::text, c.is_admin, c.access_status::text, d.id, d.name, d.kind::text, private.luzia_phase()
    from public.luzia_collaborators c
    left join public.luzia_departments d on d.id = c.department_id
   where c.auth_user_id = (select private.luzia_auth_uid())
$$;

create or replace function public.luzia_can_open(p_application_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.luzia_can_open_application(p_application_id) $$;

-- Abertura autorizada e idempotente: o mesmo open_id nunca gera dois eventos.
create or replace function public.luzia_register_open(p_application_id uuid, p_open_id uuid)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me bigint := private.luzia_current_collaborator_id();
  v_id bigint;
  v_owner bigint;
begin
  if v_me is null then
    raise exception 'Colaborador sem acesso ativo.' using errcode = '42501', hint = 'luzia_inactive';
  end if;
  if p_open_id is null then
    raise exception 'Identificador de abertura obrigatório.' using errcode = '22023';
  end if;
  if not private.luzia_can_open_application(p_application_id) then
    raise exception 'Aplicação não autorizada.' using errcode = '42501', hint = 'luzia_app_denied';
  end if;
  insert into public.luzia_access_events (open_id, collaborator_id, application_id)
  values (p_open_id, v_me, p_application_id)
  on conflict (open_id) do nothing
  returning id into v_id;
  if v_id is null then
    select e.id, e.collaborator_id into v_id, v_owner from public.luzia_access_events e where e.open_id = p_open_id;
    if v_owner is distinct from v_me then
      raise exception 'Identificador de abertura inválido.' using errcode = '42501';
    end if;
  end if;
  return v_id;
end
$$;

create or replace function public.luzia_admin_save_department(p_id bigint, p_name text)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id bigint := p_id;
begin
  perform private.luzia_require_admin_write();
  if v_id is null then
    insert into public.luzia_departments (name, created_by) values (btrim(p_name), auth.uid()) returning id into v_id;
  else
    update public.luzia_departments set name = btrim(p_name) where id = v_id;
    if not found then
      raise exception 'Departamento não encontrado.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

create or replace function public.luzia_admin_set_department_active(p_id bigint, p_active boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.luzia_require_admin_write();
  if exists (select 1 from public.luzia_departments where id = p_id and kind = 'provisioning') then
    raise exception 'O departamento de provisionamento é protegido.' using errcode = 'P0001', hint = 'luzia_protected_department';
  end if;
  update public.luzia_departments set active = p_active where id = p_id;
  if not found then
    raise exception 'Departamento não encontrado.' using errcode = 'P0002';
  end if;
end
$$;

-- Identidade e e-mail não fazem parte desta função (procedimento próprio: luzia_admin_change_identity).
create or replace function public.luzia_admin_update_collaborator(
  p_id bigint, p_department_id bigint, p_role text, p_is_admin boolean, p_access_status text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.luzia_require_admin_write();
  if not exists (select 1 from public.luzia_departments d where d.id = p_department_id and (d.active or d.kind = 'provisioning')) then
    raise exception 'Departamento inválido ou inativo.' using errcode = '22023';
  end if;
  update public.luzia_collaborators
     set department_id = p_department_id, role = p_role::public.luzia_hierarchy_role,
         is_admin = p_is_admin, access_status = p_access_status::public.luzia_access_status
   where id = p_id;
  if not found then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;
end
$$;

create or replace function public.luzia_admin_change_identity(p_id bigint, p_new_auth_user_id uuid, p_new_email text, p_reason text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.luzia_require_admin_write();
  if coalesce(char_length(btrim(p_reason)), 0) < 10 then
    raise exception 'Informe o motivo da troca de identidade.' using errcode = '22023';
  end if;
  perform set_config('luzia.audit_reason', 'troca-identidade: ' || btrim(p_reason), true);
  update public.luzia_collaborators set auth_user_id = p_new_auth_user_id, email = lower(btrim(p_new_email)) where id = p_id;
  if not found then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;
  perform set_config('luzia.audit_reason', '', true);
end
$$;

create or replace function public.luzia_admin_save_application(
  p_id uuid, p_name text, p_description text, p_url text, p_icon text, p_active boolean, p_audience text, p_department_ids bigint[]
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_depts bigint[] := case when p_audience = 'all_departments' then array[]::bigint[] else coalesce(p_department_ids, array[]::bigint[]) end;
begin
  perform private.luzia_require_admin_write();
  if p_audience not in ('all_departments', 'selected_departments') then
    raise exception 'Audiência inválida.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_depts) x left join public.luzia_departments d on d.id = x where d.id is null or d.kind <> 'regular') then
    raise exception 'Departamento inválido na audiência.' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.luzia_applications (name, description, url, icon, active, audience, created_by)
    values (btrim(p_name), nullif(btrim(p_description), ''), btrim(p_url), nullif(btrim(p_icon), ''), p_active, p_audience::public.luzia_audience, auth.uid())
    returning id into v_id;
  else
    update public.luzia_applications
       set name = btrim(p_name), description = nullif(btrim(p_description), ''), url = btrim(p_url),
           icon = nullif(btrim(p_icon), ''), active = p_active, audience = p_audience::public.luzia_audience
     where id = v_id;
    if not found then
      raise exception 'Aplicação não encontrada.' using errcode = 'P0002';
    end if;
  end if;
  delete from public.luzia_application_departments where application_id = v_id and not (department_id = any (v_depts));
  insert into public.luzia_application_departments (application_id, department_id)
    select v_id, x from unnest(v_depts) x on conflict do nothing;
  return v_id;
end
$$;

create or replace function public.luzia_admin_save_news(p_id uuid, p_title text, p_body text, p_version text, p_published_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.luzia_require_admin_write();
  if v_id is null then
    insert into public.luzia_news (title, body, version, published_at, created_by)
    values (btrim(p_title), btrim(p_body), nullif(btrim(p_version), ''), p_published_at, auth.uid())
    returning id into v_id;
  else
    update public.luzia_news
       set title = btrim(p_title), body = btrim(p_body), version = nullif(btrim(p_version), ''), published_at = p_published_at
     where id = v_id;
    if not found then
      raise exception 'Novidade não encontrada.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

-- Adota cadastros criados no legado depois do corte (ex.: gatilho on_auth_user_created). Só insere; nunca sobrescreve.
create or replace function public.luzia_admin_adopt_legacy_collaborators()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_provisioning bigint;
  v_count integer;
begin
  perform private.luzia_require_admin_write();
  select d.id into v_provisioning from public.luzia_departments d where d.kind = 'provisioning';
  perform set_config('luzia.audit_reason', 'adocao-cadastro-legado', true);
  insert into public.luzia_collaborators (id, auth_user_id, name, email, department_id, role, is_admin)
  select u.user_id, u.auth_user_id, btrim(u.user_name), lower(btrim(u.user_email)),
         coalesce((select d.id from public.luzia_departments d where d.id = u.user_dpto), v_provisioning),
         u.user_role::public.luzia_hierarchy_role, false
    from public.users u
   where not exists (select 1 from public.luzia_collaborators c where c.id = u.user_id)
     and not exists (select 1 from public.luzia_collaborators c where c.email = lower(btrim(u.user_email)))
     and not exists (select 1 from public.luzia_collaborators c where c.auth_user_id = u.auth_user_id)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  perform set_config('luzia.audit_reason', '', true);
  return v_count;
end
$$;

-- Escopo gerencial (relatórios de acesso e adaptadores de atividades).
create or replace function public.luzia_report_scope()
returns table (collaborator_id bigint, name text, email text, department_id bigint, role text)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.luzia_can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.email, c.department_id, c.role::text
      from public.luzia_collaborators c
     where c.id in (select private.luzia_visible_collaborator_ids())
     order by c.name;
end
$$;

create or replace function public.luzia_report_application_names()
returns table (application_id uuid, name text)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.luzia_can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  return query select an.id, an.name from private.luzia_application_names() an order by an.name;
end
$$;

create or replace function public.luzia_report_access_page(
  p_from date, p_to date,
  p_application_id uuid default null, p_collaborator_id bigint default null, p_department_id bigint default null,
  p_limit int default 25, p_offset int default 0
)
returns table (
  event_id bigint, opened_at timestamptz, collaborator_id bigint, collaborator_name text,
  department_id bigint, department_name text, application_id uuid, application_name text, total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  b record;
begin
  if not private.luzia_can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Paginação inválida.' using errcode = '22023';
  end if;
  select * into b from private.luzia_report_bounds(p_from, p_to);
  return query
    select e.id, e.opened_at, c.id, c.name, d.id, d.name, e.application_id, an.name, count(*) over ()
      from public.luzia_access_events e
      join public.luzia_collaborators c on c.id = e.collaborator_id
      left join public.luzia_departments d on d.id = c.department_id
      left join private.luzia_application_names() an on an.id = e.application_id
     where e.opened_at >= b.ts_from and e.opened_at < b.ts_to
       and e.collaborator_id in (select private.luzia_visible_collaborator_ids())
       and (p_application_id is null or e.application_id = p_application_id)
       and (p_collaborator_id is null or e.collaborator_id = p_collaborator_id)
       and (p_department_id is null or c.department_id = p_department_id)
     order by e.opened_at desc, e.id desc
     limit p_limit offset p_offset;
end
$$;

create or replace function public.luzia_report_access_metrics(
  p_from date, p_to date,
  p_application_id uuid default null, p_collaborator_id bigint default null, p_department_id bigint default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  b record;
  v_result jsonb;
begin
  if not private.luzia_can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  select * into b from private.luzia_report_bounds(p_from, p_to);
  with filtered as (
    select e.id, e.collaborator_id, e.application_id, (e.opened_at at time zone 'America/Sao_Paulo')::date as day
      from public.luzia_access_events e
      join public.luzia_collaborators c on c.id = e.collaborator_id
     where e.opened_at >= b.ts_from and e.opened_at < b.ts_to
       and e.collaborator_id in (select private.luzia_visible_collaborator_ids())
       and (p_application_id is null or e.application_id = p_application_id)
       and (p_collaborator_id is null or e.collaborator_id = p_collaborator_id)
       and (p_department_id is null or c.department_id = p_department_id)
  ),
  top_apps as (
    select f.application_id, an.name, count(*) as total
      from filtered f left join private.luzia_application_names() an on an.id = f.application_id
     group by f.application_id, an.name
     order by total desc, f.application_id
     limit 10
  ),
  days as (select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g),
  daily as (select d.day, count(f.id) as total from days d left join filtered f on f.day = d.day group by d.day)
  select jsonb_build_object(
    'total_opens', (select count(*) from filtered),
    'distinct_collaborators', (select count(distinct f.collaborator_id) from filtered f),
    'top_applications', coalesce((select jsonb_agg(jsonb_build_object('application_id', t.application_id, 'name', t.name, 'total', t.total) order by t.total desc, t.application_id) from top_apps t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(dl.day, 'YYYY-MM-DD'), 'total', dl.total) order by dl.day) from daily dl), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.luzia_provision_me()', 'public.luzia_my_profile()', 'public.luzia_can_open(uuid)', 'public.luzia_register_open(uuid, uuid)',
    'public.luzia_admin_save_department(bigint, text)', 'public.luzia_admin_set_department_active(bigint, boolean)',
    'public.luzia_admin_update_collaborator(bigint, bigint, text, boolean, text)',
    'public.luzia_admin_change_identity(bigint, uuid, text, text)',
    'public.luzia_admin_save_application(uuid, text, text, text, text, boolean, text, bigint[])',
    'public.luzia_admin_save_news(uuid, text, text, text, timestamptz)', 'public.luzia_admin_adopt_legacy_collaborators()',
    'public.luzia_report_scope()', 'public.luzia_report_application_names()',
    'public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int)',
    'public.luzia_report_access_metrics(date, date, uuid, bigint, bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- Funções de gatilho não recebem grants.
revoke all on function private.luzia_set_updated_at(), private.luzia_reject_delete(), private.luzia_reject_update(),
  private.luzia_departments_guard(), private.luzia_collaborators_guard(), private.luzia_check_audience(), private.luzia_audit_row(),
  private.luzia_departments_mirror_before(), private.luzia_departments_mirror_after(),
  private.luzia_collaborators_mirror_before(), private.luzia_collaborators_mirror_after() from public, anon, authenticated;

commit;
