-- SIMULAÇÃO DA PLATAFORMA SUPABASE — SOMENTE PARA TESTES LOCAIS (PGlite).
-- Imita o mínimo de auth.*, papéis e privilégios padrão do Supabase para que
-- migrations e políticas RLS possam ser exercitadas sem Docker.
-- Nunca executar em um projeto Supabase: lá esses objetos já existem.

do $$
begin
  if to_regclass('auth.users') is not null then
    raise exception 'shim: auth.users já existe; este script é só para banco de teste vazio';
  end if;
end
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_id text not null,
  identity_data jsonb not null default '{}'::jsonb,
  unique (provider, provider_id)
);

-- Supabase lê o JWT pelo GUC request.jwt.claims (PostgREST) e mantém a forma antiga request.jwt.claim.sub.
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), auth.jwt() ->> 'sub'), '')::uuid
$$;

grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

-- Privilégios padrão do Supabase no schema public: tudo para os papéis da API.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
