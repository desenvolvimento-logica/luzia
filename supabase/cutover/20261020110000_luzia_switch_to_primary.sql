-- CORTE: o hub novo passa a ser a fonte da verdade (fase primary).
-- Executar somente com o hub antigo em modo leitura (cadastros congelados) e com aprovação.
--
-- Efeitos:
--   * reimportação final do legado (idempotente);
--   * a partir daqui, departamentos e colaboradores criados/alterados no hub novo são espelhados para
--     public.dpto e public.users (mesmos IDs), mantendo HelpDesk GC e lic_ funcionando;
--   * aplicações, audiências, estado de acesso e novidades vivem só nas tabelas luzia_.
-- Não altera gatilhos de auth.users (on_auth_user_created continua criando public.users; o hub adota esses
-- cadastros no primeiro login ou por luzia_admin_adopt_legacy_collaborators()).
-- Reversão: supabase/rollback/20261020110000_luzia_switch_to_primary.down.sql

begin;

do $$
begin
  if private.luzia_phase() <> 'coexistence' then
    raise exception 'luzia: fase atual não é coexistence; corte já feito?';
  end if;
end
$$;

select private.luzia_import_legacy() as importacao_final;

do $$
begin
  if not exists (select 1 from public.luzia_collaborators where is_admin and access_status = 'active' and auth_user_id is not null) then
    raise exception 'luzia: nenhum administrador ativo com identidade vinculada; corte abortado';
  end if;
  if not exists (select 1 from public.luzia_settings where key = 'azure_tenant_id' and value <> '') then
    raise exception 'luzia: tenant corporativo não configurado em luzia_settings; corte abortado';
  end if;
end
$$;

update public.luzia_settings set value = 'primary' where key = 'phase';

commit;
