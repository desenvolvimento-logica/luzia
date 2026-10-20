-- Reversão de 20261020130000_luzia_news_any_phase: volta à definição da fundação (admin + fase primary).

begin;

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

revoke all on function public.luzia_admin_save_news(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.luzia_admin_save_news(uuid, text, text, text, timestamptz) to authenticated;

commit;
