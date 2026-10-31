-- Step 7: faster pages. Counts how many (not deleted) permits use each dropdown value,
-- inside the database, so the new-permit form and the Lists page no longer have to read
-- every permit just to order or label the dropdowns.
--
-- Safe to run more than once. It only ADDS a function: no table or data is changed.
-- If you skip this file the site still works (it falls back to the slower way).
--
-- "security invoker": the function runs with the caller's own rights, so the same row
-- level security as reading the permits table applies.

create or replace function public.option_usage()
returns table (list text, value text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 'area'::text, upper(btrim(area, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(area, E' \t\r\n') <> '' group by 2
  union all
  select 'permit_type', upper(btrim(permit_type, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(permit_type, E' \t\r\n') <> '' group by 2
  union all
  select 'applicant', upper(btrim(applicant, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(applicant, E' \t\r\n') <> '' group by 2
  union all
  select 'holder', upper(btrim(holder, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(holder, E' \t\r\n') <> '' group by 2
  union all
  select 'issuer', upper(btrim(issuer, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(issuer, E' \t\r\n') <> '' group by 2
  union all
  select 'controller', upper(btrim(controller, E' \t\r\n')), count(*) from public.permits
    where deleted_at is null and btrim(controller, E' \t\r\n') <> '' group by 2
  union all
  select 'certificate', k, count(*)
  from (
    select upper(btrim(
             case when jsonb_typeof(c) = 'string' then c #>> '{}' else coalesce(c ->> 'name', '') end,
             E' \t\r\n')) as k
    from public.permits p,
         jsonb_array_elements(case when jsonb_typeof(p.certificates) = 'array' then p.certificates else '[]'::jsonb end) c
    where p.deleted_at is null
  ) certs
  where k <> ''
  group by k
  order by 1, 2
$$;

revoke all on function public.option_usage() from public;
grant execute on function public.option_usage() to authenticated;
