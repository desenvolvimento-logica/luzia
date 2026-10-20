-- Luz.IA — novidades podem ser publicadas pelo hub novo também na fase coexistence.
-- As novidades existem só em luzia_news (sem espelho para o legado), então a trava de fase não protege nada aqui.
-- Só substitui public.luzia_admin_save_news. Reversão: supabase/rollback/20261020130000_luzia_news_any_phase.down.sql

begin;

create or replace function public.luzia_admin_save_news(p_id uuid, p_title text, p_body text, p_version text, p_published_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  -- Novidades vivem só em luzia_ (sem espelho no legado): basta admin ativo, em qualquer fase.
  if not private.luzia_is_admin() then
    raise exception 'Somente administradores.' using errcode = '42501', hint = 'luzia_not_admin';
  end if;
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

revoke all on function public.luzia_admin_save_news(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.luzia_admin_save_news(uuid, text, text, text, timestamptz) to authenticated;

commit;
