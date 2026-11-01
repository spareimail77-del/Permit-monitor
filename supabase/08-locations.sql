-- Step 8: a managed Location list.
--
-- Locations become a dropdown list like Area or Permit type, but ONLY ROOT can add,
-- rename-by-hiding or show locations. Root and HSE can read the list and pick from it.
-- Old permits keep their location text untouched.
--
-- Safe to run more than once. No permit data is changed.
-- Run it BEFORE deploying the new code.

-- 1. Allow 'location' as a list name (the old check only knew the first seven lists).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.permit_options'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%permit_type%'
  loop
    execute format('alter table public.permit_options drop constraint %I', c);
  end loop;
end $$;

alter table public.permit_options
  add constraint permit_options_list_check check (list in
    ('area', 'location', 'permit_type', 'certificate', 'applicant', 'holder', 'issuer', 'controller'));

-- 2. Who may change the lists: Root and HSE for every list EXCEPT location, Root only for location.
drop policy if exists "HSE and root can add options" on public.permit_options;
create policy "HSE and root can add options" on public.permit_options
  for insert with check (
    (list <> 'location' and public.active_role() in ('root', 'hse'))
    or (list = 'location' and public.active_role() = 'root')
  );

drop policy if exists "HSE and root can change options" on public.permit_options;
create policy "HSE and root can change options" on public.permit_options
  for update
  using (
    (list <> 'location' and public.active_role() in ('root', 'hse'))
    or (list = 'location' and public.active_role() = 'root')
  )
  with check (
    (list <> 'location' and public.active_role() in ('root', 'hse'))
    or (list = 'location' and public.active_role() = 'root')
  );
