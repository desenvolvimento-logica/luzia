-- CORTE (executar somente quando o hub antigo deixar de atender): remove o auto-provisionamento legado
-- disparado em auth.users. A partir daí, cadastro no hub só ocorre por public.luzia_provision_me(),
-- que valida o tenant corporativo (R-02, R-03 da spec operacional).
--
-- O gatilho é localizado pela função que executa (public.link_auth_user_to_app_user), porque o nome real
-- do gatilho em produção não foi verificado. Gatilhos de outras aplicações em auth.users
-- (ex.: on_auth_user_created_cc do contcheck) não são tocados.
-- Reversão: recriar o gatilho com a definição salva em private.trigger_backup.

create table if not exists private.trigger_backup (
  trigger_name text primary key,
  definition text not null,
  saved_at timestamptz not null default now()
);
revoke all on private.trigger_backup from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select t.tgname, pg_get_triggerdef(t.oid) as def
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
     where t.tgrelid = 'auth.users'::regclass
       and not t.tgisinternal
       and n.nspname = 'public'
       and p.proname = 'link_auth_user_to_app_user'
  loop
    insert into private.trigger_backup (trigger_name, definition) values (r.tgname, r.def)
      on conflict (trigger_name) do update set definition = excluded.definition, saved_at = now();
    execute format('drop trigger %I on auth.users', r.tgname);
  end loop;
end
$$;
