-- Reversão de 20261020120000_luzia_reports_v2: volta às definições da fundação (20261020100000).
-- Definições copiadas literalmente da migração da fundação. Não toca em dados.
-- Antes de reverter, publicar um frontend que não envie p_sort/p_dir.

begin;

drop function if exists public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int, text, text);

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

revoke all on function public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int) from public, anon;
grant execute on function public.luzia_report_access_page(date, date, uuid, bigint, bigint, int, int) to authenticated;
revoke all on function public.luzia_report_access_metrics(date, date, uuid, bigint, bigint) from public, anon;
grant execute on function public.luzia_report_access_metrics(date, date, uuid, bigint, bigint) to authenticated;

commit;
