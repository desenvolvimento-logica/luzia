-- Luz.IA v2 — migração incremental CANDIDATA sobre o schema legado do hub.
--
-- Estado: ensaiada apenas em PGlite sobre a reconstrução hipotética do legado (supabase/dev/01_legacy_baseline.sql).
-- Antes de usar em qualquer banco compartilhado: comparar com o dump real de schema (docs/decisoes.md X-02),
-- ensaiar numa cópia isolada, confirmar backup (X-08) e obter aprovação das mudanças de autorização (X-10).
-- Reversão: supabase/rollback/20261019000100_hub_v2_foundation.down.sql (preserva dados novos).
--
-- Não remove tabelas, colunas ou linhas. Substitui as políticas RLS das tabelas do hub, guardando as
-- definições anteriores em private.policy_backup para a reversão.

-- ---------------------------------------------------------------------------
-- 0. Schema privado e configuração
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table if not exists private.settings (
  key text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

create table if not exists private.policy_backup (
  migration text not null,
  tablename text not null,
  policyname text not null,
  permissive text not null,
  roles text[] not null,
  cmd text not null,
  qual text,
  with_check text,
  saved_at timestamptz not null default now(),
  primary key (migration, tablename, policyname)
);
revoke all on private.policy_backup from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Extensões de dados (com backfill que preserva a interpretação do legado)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists access_status text not null default 'ativo';
alter table public.users add column if not exists status_changed_at timestamptz;
do $$ begin
  alter table public.users add constraint users_access_status_check check (access_status in ('ativo', 'desativado'));
exception when duplicate_object then null; end $$;

alter table public.dpto add column if not exists dpto_kind text not null default 'normal';
do $$ begin
  alter table public.dpto add constraint dpto_kind_check check (dpto_kind in ('normal', 'provisionamento'));
exception when duplicate_object then null; end $$;
insert into public.dpto (dpto_name, user_create)
  select 'Não atribuído', 'luzia-v2-migracao'
  where not exists (select 1 from public.dpto where dpto_name = 'Não atribuído');
update public.dpto set dpto_kind = 'provisionamento' where dpto_name = 'Não atribuído' and dpto_kind <> 'provisionamento';
create unique index if not exists dpto_single_provisioning_idx on public.dpto (dpto_kind) where dpto_kind = 'provisionamento';

alter table public.applications add column if not exists audience text;
update public.applications a
   set audience = case
     when exists (select 1 from public.applications_dpto d where d.app_id = a.app_id) then 'selecionados'
     else 'todos'
   end
 where a.audience is null;
alter table public.applications alter column audience set default 'selecionados';
alter table public.applications alter column audience set not null;
do $$ begin
  alter table public.applications add constraint applications_audience_check check (audience in ('todos', 'selecionados'));
exception when duplicate_object then null; end $$;
-- Só bloqueia esquemas perigosos e credenciais embutidas; a lista de origens aprovadas fica na configuração do servidor.
-- NOT VALID: não reprova linhas legadas, mas vale para toda escrita nova.
do $$ begin
  alter table public.applications add constraint applications_app_url_safe_check
    check (app_url ~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$') not valid;
exception when duplicate_object then null; end $$;

alter table public.access_log add column if not exists open_id uuid;
-- Em tabela grande, preferir criar este índice antes, fora da transação, com CREATE UNIQUE INDEX CONCURRENTLY.
create unique index if not exists access_log_open_id_key on public.access_log (open_id);
create index if not exists access_log_user_datetime_idx on public.access_log (user_id, datetime);

create table if not exists public.admin_audit (
  audit_id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_auth_id uuid,
  actor_user_id bigint,
  action text not null,
  entity text not null,
  entity_id text not null,
  changes jsonb not null default '{}'::jsonb,
  reason text
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_entity_idx on public.admin_audit (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 2. Funções de autorização (privadas, SECURITY DEFINER, search_path vazio)
-- ---------------------------------------------------------------------------
create or replace function private.me()
returns public.users
language sql stable security definer set search_path = ''
as $$
  select u.* from public.users u
   where u.auth_user_id = (select auth.uid()) and u.access_status = 'ativo'
$$;

create or replace function private.current_user_id()
returns bigint
language sql stable security definer set search_path = ''
as $$ select (private.me()).user_id $$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((private.me()).is_admin, false) $$;

create or replace function private.can_see_reports()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(m.is_admin or m.user_role <> 'usuario', false)
    from private.me() m
$$;

-- Matriz hierárquica (spec 4 / RN-10). Mantida em sincronia com src/lib/auth/matrix.ts.
create or replace function private.visible_user_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select u.user_id
    from public.users u, private.me() m
   where m.user_id is not null
     and (
       m.is_admin
       or m.user_role in ('gerente', 'diretor')
       or (m.user_role = 'coordenador' and u.user_dpto = m.user_dpto and u.user_role in ('usuario', 'lider'))
       or (m.user_role = 'lider' and u.user_dpto = m.user_dpto and u.user_role = 'usuario')
     )
$$;

create or replace function private.can_open_app(p_app_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select a.app_status and (
             m.is_admin
             or (
               d.dpto_kind = 'normal'
               and (
                 a.audience = 'todos'
                 or exists (select 1 from public.applications_dpto ad where ad.app_id = a.app_id and ad.dpto_id = m.user_dpto)
               )
             )
           )
      from public.applications a
      cross join private.me() m
      left join public.dpto d on d.dpto_id = m.user_dpto
     where a.app_id = p_app_id and m.user_id is not null
  ), false)
$$;

create or replace function private.app_names()
returns table (app_id bigint, app_name text)
language sql stable security definer set search_path = ''
as $$
  select a.app_id, a.app_name from public.applications a where private.can_see_reports()
$$;

revoke all on function private.me(), private.current_user_id(), private.is_admin(), private.can_see_reports(),
  private.visible_user_ids(), private.can_open_app(bigint), private.app_names() from public, anon;
grant execute on function private.me(), private.current_user_id(), private.is_admin(), private.can_see_reports(),
  private.visible_user_ids(), private.can_open_app(bigint), private.app_names() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Gatilhos de integridade
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER de propósito: current_user identifica quem executa a alteração.
create or replace function private.users_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_was_active_admin boolean := old.is_admin and old.access_status = 'ativo';
  v_is_active_admin boolean;
begin
  if tg_op = 'UPDATE' then
    -- Identidade vinculada só muda por função privilegiada (admin_change_identity) ou operador de banco.
    if current_user in ('authenticated', 'anon') then
      if old.auth_user_id is not null and new.auth_user_id is distinct from old.auth_user_id then
        raise exception 'A identidade vinculada não pode ser alterada diretamente.' using errcode = '42501';
      end if;
      if old.auth_user_id is not null and lower(new.user_email) is distinct from lower(old.user_email) then
        raise exception 'O e-mail de uma conta vinculada não pode ser alterado diretamente.' using errcode = '42501';
      end if;
    end if;
    if new.access_status is distinct from old.access_status then
      new.status_changed_at := now();
    end if;
    v_is_active_admin := new.is_admin and new.access_status = 'ativo';
  else
    v_is_active_admin := false;
  end if;

  if v_was_active_admin and not v_is_active_admin then
    -- Serializa alterações concorrentes de administradores; cada consulta abaixo usa um snapshot novo.
    perform pg_advisory_xact_lock(hashtext('luzia:last-active-admin'));
    if not exists (
      select 1 from public.users
       where is_admin and access_status = 'ativo' and user_id <> old.user_id
    ) then
      raise exception 'Não é possível remover a última conta administrativa ativa.' using errcode = 'P0001', hint = 'luzia_last_admin';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists luzia_users_guard on public.users;
create trigger luzia_users_guard
  before update or delete on public.users
  for each row execute function private.users_guard();

create or replace function private.dpto_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.dpto_kind = 'provisionamento' then
    if tg_op = 'DELETE' or new.dpto_name <> old.dpto_name or new.dpto_kind <> old.dpto_kind then
      raise exception 'O departamento de provisionamento é protegido.' using errcode = 'P0001', hint = 'luzia_protected_dpto';
    end if;
  elsif tg_op = 'UPDATE' and new.dpto_kind <> old.dpto_kind then
    raise exception 'O tipo do departamento não pode ser alterado.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.users where user_dpto = old.dpto_id)
       or exists (select 1 from public.applications_dpto where dpto_id = old.dpto_id) then
      raise exception 'Departamento possui colaboradores ou aplicações vinculadas.' using errcode = '23503', hint = 'luzia_dpto_in_use';
    end if;
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists luzia_dpto_guard on public.dpto;
create trigger luzia_dpto_guard
  before update or delete on public.dpto
  for each row execute function private.dpto_guard();

create or replace function private.applications_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.access_log where app_id = old.app_id) then
    raise exception 'Aplicação com histórico de acessos: desative em vez de excluir.' using errcode = '23503', hint = 'luzia_app_has_history';
  end if;
  return old;
end
$$;

drop trigger if exists luzia_applications_guard on public.applications;
create trigger luzia_applications_guard
  before delete on public.applications
  for each row execute function private.applications_guard();

-- Audiência "selecionados" exige ao menos um departamento; verificado no fim da transação.
create or replace function private.check_app_audience()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_app_id bigint := case when tg_table_name = 'applications' then new.app_id else old.app_id end;
begin
  if exists (
    select 1 from public.applications a
     where a.app_id = v_app_id
       and a.audience = 'selecionados'
       and not exists (select 1 from public.applications_dpto d where d.app_id = a.app_id)
  ) then
    raise exception 'Aplicação com audiência "Departamentos selecionados" precisa de ao menos um departamento.'
      using errcode = '23514', hint = 'luzia_audience_empty';
  end if;
  return null;
end
$$;

drop trigger if exists luzia_app_audience_check on public.applications;
create constraint trigger luzia_app_audience_check
  after insert or update on public.applications
  deferrable initially deferred
  for each row execute function private.check_app_audience();

drop trigger if exists luzia_app_dpto_audience_check on public.applications_dpto;
create constraint trigger luzia_app_dpto_audience_check
  after delete or update on public.applications_dpto
  deferrable initially deferred
  for each row execute function private.check_app_audience();

-- ---------------------------------------------------------------------------
-- 4. Auditoria administrativa atômica (mesma transação da mutação)
-- ---------------------------------------------------------------------------
create or replace function private.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity_id text;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  -- Dados pessoais repetidos não são copiados em inserções/exclusões; alterações deles continuam registradas.
  v_skip text[] := case tg_table_name when 'users' then array['user_name', 'user_email'] else array[]::text[] end;
begin
  v_entity_id := case tg_table_name
    when 'dpto' then v_row ->> 'dpto_id'
    when 'users' then v_row ->> 'user_id'
    when 'applications' then v_row ->> 'app_id'
    when 'applications_dpto' then (v_row ->> 'app_id') || ':' || (v_row ->> 'dpto_id')
    when 'patch_notes' then v_row ->> 'note_id'
    else 'desconhecido'
  end;

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  else
    v_changes := v_row - v_skip;
  end if;

  insert into public.admin_audit (actor_auth_id, actor_user_id, action, entity, entity_id, changes, reason)
  values (
    (select auth.uid()),
    (select u.user_id from public.users u where u.auth_user_id = (select auth.uid())),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
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
  foreach t in array array['dpto', 'users', 'applications', 'applications_dpto', 'patch_notes'] loop
    execute format('drop trigger if exists luzia_audit on public.%I', t);
    execute format('create trigger luzia_audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Políticas RLS (substituem as do legado; definições anteriores ficam em private.policy_backup)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from pg_policies
     where schemaname = 'public'
       and tablename in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
       and policyname not like 'luzia\_%'
  loop
    insert into private.policy_backup (migration, tablename, policyname, permissive, roles, cmd, qual, with_check)
    values ('20261019000100', r.tablename, r.policyname, r.permissive, r.roles::text[], r.cmd, r.qual, r.with_check)
    on conflict do nothing;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

alter table public.dpto enable row level security;
alter table public.users enable row level security;
alter table public.applications enable row level security;
alter table public.applications_dpto enable row level security;
alter table public.access_log enable row level security;
alter table public.patch_notes enable row level security;
alter table public.admin_audit enable row level security;

-- Departamentos
drop policy if exists luzia_dpto_select on public.dpto;
create policy luzia_dpto_select on public.dpto for select to authenticated
  using ((select private.current_user_id()) is not null);
drop policy if exists luzia_dpto_insert on public.dpto;
create policy luzia_dpto_insert on public.dpto for insert to authenticated
  with check ((select private.is_admin()) and dpto_kind = 'normal');
drop policy if exists luzia_dpto_update on public.dpto;
create policy luzia_dpto_update on public.dpto for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists luzia_dpto_delete on public.dpto;
create policy luzia_dpto_delete on public.dpto for delete to authenticated
  using ((select private.is_admin()));

-- Colaboradores: o próprio registro (mesmo desativado, para a interface explicar o estado) + escopo da matriz.
drop policy if exists luzia_users_select on public.users;
create policy luzia_users_select on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()) or user_id in (select private.visible_user_ids()));
drop policy if exists luzia_users_insert on public.users;
create policy luzia_users_insert on public.users for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists luzia_users_update on public.users;
create policy luzia_users_update on public.users for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists luzia_users_delete on public.users;
create policy luzia_users_delete on public.users for delete to authenticated
  using ((select private.is_admin()));

-- Aplicações: admin vê todas (inclusive inativas) na administração; demais só as que podem abrir.
drop policy if exists luzia_apps_select on public.applications;
create policy luzia_apps_select on public.applications for select to authenticated
  using ((select private.is_admin()) or private.can_open_app(app_id));
drop policy if exists luzia_apps_insert on public.applications;
create policy luzia_apps_insert on public.applications for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists luzia_apps_update on public.applications;
create policy luzia_apps_update on public.applications for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists luzia_apps_delete on public.applications;
create policy luzia_apps_delete on public.applications for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists luzia_apps_dpto_select on public.applications_dpto;
create policy luzia_apps_dpto_select on public.applications_dpto for select to authenticated
  using ((select private.current_user_id()) is not null);
drop policy if exists luzia_apps_dpto_insert on public.applications_dpto;
create policy luzia_apps_dpto_insert on public.applications_dpto for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists luzia_apps_dpto_update on public.applications_dpto;
create policy luzia_apps_dpto_update on public.applications_dpto for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists luzia_apps_dpto_delete on public.applications_dpto;
create policy luzia_apps_dpto_delete on public.applications_dpto for delete to authenticated
  using ((select private.is_admin()));

-- Novidades: publicadas para colaboradores ativos; agendadas só para admin.
drop policy if exists luzia_patch_notes_select on public.patch_notes;
create policy luzia_patch_notes_select on public.patch_notes for select to authenticated
  using ((select private.current_user_id()) is not null and (dt_publish <= now() or (select private.is_admin())));
drop policy if exists luzia_patch_notes_insert on public.patch_notes;
create policy luzia_patch_notes_insert on public.patch_notes for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists luzia_patch_notes_update on public.patch_notes;
create policy luzia_patch_notes_update on public.patch_notes for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists luzia_patch_notes_delete on public.patch_notes;
create policy luzia_patch_notes_delete on public.patch_notes for delete to authenticated
  using ((select private.is_admin()));

-- Acessos: leitura no escopo gerencial; inserção só do próprio colaborador ativo e para app que ele pode abrir
-- (mantém o hub antigo funcionando durante a coexistência); sem update/delete para clientes.
drop policy if exists luzia_access_log_select on public.access_log;
create policy luzia_access_log_select on public.access_log for select to authenticated
  using ((select private.can_see_reports()) and user_id in (select private.visible_user_ids()));
drop policy if exists luzia_access_log_insert on public.access_log;
create policy luzia_access_log_insert on public.access_log for insert to authenticated
  with check (user_id = (select private.current_user_id()) and private.can_open_app(app_id));

drop policy if exists luzia_admin_audit_select on public.admin_audit;
create policy luzia_admin_audit_select on public.admin_audit for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Privilégios explícitos (estado anterior guardado para a reversão)
-- ---------------------------------------------------------------------------
create table if not exists private.grant_backup (
  migration text not null,
  table_name text not null,
  grantee text not null,
  privilege_type text not null,
  primary key (migration, table_name, grantee, privilege_type)
);
revoke all on private.grant_backup from public, anon, authenticated;
insert into private.grant_backup (migration, table_name, grantee, privilege_type)
  select '20261019000100', g.table_name, g.grantee, g.privilege_type
    from information_schema.role_table_grants g
   where g.table_schema = 'public'
     and g.table_name in ('dpto', 'users', 'applications', 'applications_dpto', 'access_log', 'patch_notes')
     and g.grantee in ('anon', 'authenticated')
  on conflict do nothing;

revoke all on public.dpto, public.users, public.applications, public.applications_dpto,
  public.access_log, public.patch_notes, public.admin_audit from anon;
revoke truncate, references, trigger on public.dpto, public.users, public.applications, public.applications_dpto,
  public.access_log, public.patch_notes from authenticated;
grant select, insert, update, delete on public.dpto, public.users, public.applications,
  public.applications_dpto, public.patch_notes to authenticated;
revoke all on public.access_log from authenticated;
grant select, insert on public.access_log to authenticated;
revoke all on public.admin_audit from authenticated;
grant select on public.admin_audit to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPCs expostas ao hub
-- ---------------------------------------------------------------------------

-- Valida identidade corporativa (tenant Microsoft) e vincula/provisiona o colaborador.
-- O caminho do tid em identity_data precisa ser confirmado no projeto real (docs/decisoes.md X-03).
create or replace function public.luzia_provision_me()
returns table (user_id bigint, access_status text, provisioned boolean, linked boolean)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_tenant text;
  v_email text;
  v_name text;
  v_existing public.users;
  v_dpto bigint;
begin
  if v_uid is null then
    raise exception 'Sessão ausente.' using errcode = '28000', hint = 'luzia_no_session';
  end if;

  select s.value into v_tenant from private.settings s where s.key = 'azure_tenant_id';
  if v_tenant is null or v_tenant = '' then
    raise exception 'Tenant corporativo não configurado.' using errcode = '28000', hint = 'luzia_tenant_not_configured';
  end if;

  if not exists (
    select 1 from auth.identities i
     where i.user_id = v_uid
       and i.provider = 'azure'
       and lower(coalesce(i.identity_data ->> 'tid', i.identity_data -> 'custom_claims' ->> 'tid', '')) = lower(v_tenant)
  ) then
    raise exception 'Conta não pertence ao tenant corporativo.' using errcode = '28000', hint = 'luzia_foreign_account';
  end if;

  select u.* into v_existing from public.users u where u.auth_user_id = v_uid;
  if found then
    return query select v_existing.user_id, v_existing.access_status, false, false;
    return;
  end if;

  select lower(au.email),
         coalesce(nullif(au.raw_user_meta_data ->> 'full_name', ''), nullif(au.raw_user_meta_data ->> 'name', ''), split_part(au.email, '@', 1))
    into v_email, v_name
    from auth.users au where au.id = v_uid;
  if v_email is null or v_email = '' then
    raise exception 'Conta sem e-mail.' using errcode = '28000', hint = 'luzia_no_email';
  end if;

  -- Conciliação legada por e-mail: só vincula cadastro ainda sem identidade.
  select u.* into v_existing from public.users u where lower(u.user_email) = v_email for update;
  if found then
    if v_existing.auth_user_id is not null then
      raise exception 'Cadastro já vinculado a outra identidade.' using errcode = '28000', hint = 'luzia_identity_conflict';
    end if;
    perform set_config('luzia.audit_reason', 'vinculo-primeiro-acesso', true);
    update public.users u set auth_user_id = v_uid where u.user_id = v_existing.user_id;
    perform set_config('luzia.audit_reason', '', true);
    return query select v_existing.user_id, v_existing.access_status, false, true;
    return;
  end if;

  select d.dpto_id into v_dpto from public.dpto d where d.dpto_kind = 'provisionamento';
  perform set_config('luzia.audit_reason', 'provisionamento-primeiro-acesso', true);
  begin
    insert into public.users (auth_user_id, user_name, user_email, user_dpto, user_role, is_admin, user_create)
    values (v_uid, v_name, v_email, v_dpto, 'usuario', false, 'provisionamento-luzia');
  exception when unique_violation then
    -- Requisição concorrente do mesmo colaborador (ou gatilho legado) já criou o cadastro.
    null;
  end;
  perform set_config('luzia.audit_reason', '', true);

  return query select u.user_id, u.access_status, true, false from public.users u where u.auth_user_id = v_uid;
end
$$;

-- Abertura autorizada e idempotente: o mesmo open_id nunca gera dois eventos.
create or replace function public.luzia_register_open(p_app_id bigint, p_open_id uuid)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user bigint := private.current_user_id();
  v_log bigint;
  v_owner bigint;
begin
  if v_user is null then
    raise exception 'Colaborador sem acesso ativo.' using errcode = '42501', hint = 'luzia_inactive';
  end if;
  if p_open_id is null then
    raise exception 'Identificador de abertura obrigatório.' using errcode = '22023';
  end if;
  if not private.can_open_app(p_app_id) then
    raise exception 'Aplicação não autorizada.' using errcode = '42501', hint = 'luzia_app_denied';
  end if;

  insert into public.access_log (user_id, app_id, open_id)
  values (v_user, p_app_id, p_open_id)
  on conflict (open_id) do nothing
  returning log_id into v_log;

  if v_log is null then
    select l.log_id, l.user_id into v_log, v_owner from public.access_log l where l.open_id = p_open_id;
    if v_owner is distinct from v_user then
      raise exception 'Identificador de abertura inválido.' using errcode = '42501';
    end if;
  end if;
  return v_log;
end
$$;

create or replace function public.luzia_can_open(p_app_id bigint)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.can_open_app(p_app_id) $$;

-- Salva aplicação e audiência na mesma transação; RLS e gatilhos continuam valendo (SECURITY INVOKER).
create or replace function public.admin_save_application(
  p_app_id bigint,
  p_name text,
  p_description text,
  p_url text,
  p_icon text,
  p_status boolean,
  p_audience text,
  p_dpto_ids bigint[]
)
returns bigint
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_id bigint := p_app_id;
  v_dptos bigint[] := coalesce(p_dpto_ids, array[]::bigint[]);
begin
  if not private.is_admin() then
    raise exception 'Somente administradores.' using errcode = '42501';
  end if;
  if p_audience not in ('todos', 'selecionados') then
    raise exception 'Audiência inválida.' using errcode = '22023';
  end if;
  if p_audience = 'todos' then
    v_dptos := array[]::bigint[];
  end if;

  if v_id is null then
    insert into public.applications (app_name, app_description, app_url, app_icon, app_status, audience, user_created)
    values (p_name, p_description, p_url, p_icon, p_status, p_audience, (select u.user_email from public.users u where u.user_id = private.current_user_id()))
    returning app_id into v_id;
  else
    update public.applications
       set app_name = p_name, app_description = p_description, app_url = p_url,
           app_icon = p_icon, app_status = p_status, audience = p_audience
     where app_id = v_id;
    if not found then
      raise exception 'Aplicação não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.applications_dpto where app_id = v_id and not (dpto_id = any (v_dptos));
  insert into public.applications_dpto (app_id, dpto_id)
    select v_id, x from unnest(v_dptos) as x
    on conflict do nothing;
  return v_id;
end
$$;

-- Troca de identidade vinculada: procedimento explícito, só admin, com motivo auditado.
create or replace function public.admin_change_identity(p_user_id bigint, p_new_auth_user_id uuid, p_new_email text, p_reason text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Somente administradores.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'Informe o motivo da troca de identidade.' using errcode = '22023';
  end if;
  perform set_config('luzia.audit_reason', 'troca-identidade: ' || trim(p_reason), true);
  update public.users
     set auth_user_id = p_new_auth_user_id, user_email = lower(trim(p_new_email))
   where user_id = p_user_id;
  if not found then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;
  perform set_config('luzia.audit_reason', '', true);
end
$$;

-- Escopo gerencial do solicitante (usado por relatórios de acessos e adaptadores de atividades).
create or replace function public.report_scope_users()
returns table (user_id bigint, user_name text, user_email text, user_dpto bigint, user_role text)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  return query
    select u.user_id, u.user_name, lower(u.user_email), u.user_dpto, u.user_role
      from public.users u
     where u.user_id in (select private.visible_user_ids())
     order by u.user_name;
end
$$;

-- Nomes de aplicações para filtros de relatório (inclui apps que o gestor não abre ou inativas).
create or replace function public.report_app_names()
returns table (app_id bigint, app_name text)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  return query select an.app_id, an.app_name from private.app_names() an order by an.app_name;
end
$$;

-- Validação comum de filtros de período (dias civis em America/Sao_Paulo; armazenamento em UTC).
create or replace function private.report_bounds(p_from date, p_to date)
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
  return query select (p_from::timestamp at time zone 'America/Sao_Paulo'),
                      ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
end
$$;
grant execute on function private.report_bounds(date, date) to authenticated, service_role;

create or replace function public.report_access_page(
  p_from date, p_to date,
  p_app_id bigint default null, p_user_id bigint default null, p_dpto_id bigint default null,
  p_limit int default 25, p_offset int default 0
)
returns table (
  log_id bigint, opened_at timestamptz, user_id bigint, user_name text,
  dpto_id bigint, dpto_name text, app_id bigint, app_name text, total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  b record;
begin
  if not private.can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Paginação inválida.' using errcode = '22023';
  end if;
  select * into b from private.report_bounds(p_from, p_to);
  return query
    select l.log_id, l.datetime, u.user_id, u.user_name, d.dpto_id, d.dpto_name, l.app_id, an.app_name,
           count(*) over () as total_count
      from public.access_log l
      join public.users u on u.user_id = l.user_id
      left join public.dpto d on d.dpto_id = u.user_dpto
      left join private.app_names() an on an.app_id = l.app_id
     where l.datetime >= b.ts_from and l.datetime < b.ts_to
       and l.user_id in (select private.visible_user_ids())
       and (p_app_id is null or l.app_id = p_app_id)
       and (p_user_id is null or l.user_id = p_user_id)
       and (p_dpto_id is null or u.user_dpto = p_dpto_id)
     order by l.datetime desc, l.log_id desc
     limit p_limit offset p_offset;
end
$$;

create or replace function public.report_access_metrics(
  p_from date, p_to date,
  p_app_id bigint default null, p_user_id bigint default null, p_dpto_id bigint default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  b record;
  v_result jsonb;
begin
  if not private.can_see_reports() then
    raise exception 'Sem acesso a relatórios.' using errcode = '42501';
  end if;
  select * into b from private.report_bounds(p_from, p_to);

  with filtered as (
    select l.log_id, l.user_id, l.app_id, (l.datetime at time zone 'America/Sao_Paulo')::date as day
      from public.access_log l
      join public.users u on u.user_id = l.user_id
     where l.datetime >= b.ts_from and l.datetime < b.ts_to
       and l.user_id in (select private.visible_user_ids())
       and (p_app_id is null or l.app_id = p_app_id)
       and (p_user_id is null or l.user_id = p_user_id)
       and (p_dpto_id is null or u.user_dpto = p_dpto_id)
  ),
  top_apps as (
    select f.app_id, an.app_name, count(*) as total
      from filtered f left join private.app_names() an on an.app_id = f.app_id
     group by f.app_id, an.app_name
     order by total desc, f.app_id
     limit 10
  ),
  days as (
    select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  daily as (
    select d.day, count(f.log_id) as total
      from days d left join filtered f on f.day = d.day
     group by d.day
  )
  select jsonb_build_object(
    'total_opens', (select count(*) from filtered),
    'distinct_users', (select count(distinct f.user_id) from filtered f),
    'top_apps', coalesce((select jsonb_agg(jsonb_build_object('app_id', t.app_id, 'app_name', t.app_name, 'total', t.total) order by t.total desc, t.app_id) from top_apps t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(dl.day, 'YYYY-MM-DD'), 'total', dl.total) order by dl.day) from daily dl), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;

revoke all on function public.luzia_provision_me(), public.luzia_register_open(bigint, uuid), public.luzia_can_open(bigint),
  public.admin_save_application(bigint, text, text, text, text, boolean, text, bigint[]),
  public.admin_change_identity(bigint, uuid, text, text), public.report_scope_users(), public.report_app_names(),
  public.report_access_page(date, date, bigint, bigint, bigint, int, int),
  public.report_access_metrics(date, date, bigint, bigint, bigint) from public, anon;
grant execute on function public.luzia_provision_me(), public.luzia_register_open(bigint, uuid), public.luzia_can_open(bigint),
  public.admin_save_application(bigint, text, text, text, text, boolean, text, bigint[]),
  public.admin_change_identity(bigint, uuid, text, text), public.report_scope_users(), public.report_app_names(),
  public.report_access_page(date, date, bigint, bigint, bigint, int, int),
  public.report_access_metrics(date, date, bigint, bigint, bigint) to authenticated;
