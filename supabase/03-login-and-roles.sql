-- STEP B: login and roles.
-- Run ONCE in Supabase -> SQL Editor, after 01 and 02. Safe to run again.
--
-- What it does:
--   1. creates the profiles table (one row per login account: Staff ID, role, status)
--   2. creates a profile for every account that already exists in
--      Authentication -> Users (all start as 'pending': nobody gets in until you
--      activate them, see the last section)
--   3. makes every NEW account start as 'pending' too
--   4. replaces the temporary "anyone can read and add" rules with role rules

-- ---------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  display_name text,
  role text not null default 'permit_user'
    check (role in ('root', 'manager', 'hse', 'permit_user')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- The caller's role, but only while their account is active (otherwise null =
-- no access). Every rule below uses it.
create or replace function public.active_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

-- A person can read their own profile; Root can read every profile.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "Root can read all profiles" on public.profiles;
create policy "Root can read all profiles" on public.profiles for select using (public.active_role() = 'root');
-- No insert / update / delete rule: nobody can change a profile from the site
-- itself, except the person's own name through the function below.

-- Lets a signed-in person change only their own display name.
create or replace function public.set_my_display_name(p_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if char_length(v) < 2 or char_length(v) > 40 then
    raise exception 'Name must be 2 to 40 characters';
  end if;
  update public.profiles set display_name = v where id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.set_my_display_name(text) from public;
grant execute on function public.set_my_display_name(text) to authenticated;

-- ---------------------------------------------------------------
-- 2 and 3. a profile for every account, old and new
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, staff_id, display_name, role, status)
  values (
    new.id,
    split_part(new.email, '@', 1),
    nullif(coalesce(new.raw_user_meta_data->>'display_name', new.raw_app_meta_data->>'display_name'), ''),
    'permit_user',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- The accounts that already exist (made by the old site, or by hand).
insert into public.profiles (id, staff_id, display_name, role, status)
select u.id,
       split_part(u.email, '@', 1),
       nullif(coalesce(u.raw_user_meta_data->>'display_name', u.raw_app_meta_data->>'display_name'), ''),
       'permit_user',
       'pending'
from auth.users u
where u.email like '%@staff.permit-log.internal'
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- 4. role rules (replace the temporary "TEMP step A" rules)
-- ---------------------------------------------------------------
drop policy if exists "TEMP step A: read permits" on public.permits;
drop policy if exists "TEMP step A: add permits" on public.permits;
drop policy if exists "Signed-in users can read permits" on public.permits;
drop policy if exists "HSE and root can add permits" on public.permits;
create policy "Signed-in users can read permits" on public.permits
  for select using (public.active_role() is not null);
create policy "HSE and root can add permits" on public.permits
  for insert with check (public.active_role() in ('root', 'hse'));

drop policy if exists "TEMP step A: read options" on public.permit_options;
drop policy if exists "Signed-in users can read options" on public.permit_options;
create policy "Signed-in users can read options" on public.permit_options
  for select using (public.active_role() is not null);

drop policy if exists "TEMP step A: read permit files" on public.permit_files;
drop policy if exists "TEMP step A: add permit files" on public.permit_files;
drop policy if exists "Signed-in users can read permit files" on public.permit_files;
drop policy if exists "HSE and root can add permit files" on public.permit_files;
create policy "Signed-in users can read permit files" on public.permit_files
  for select using (public.active_role() is not null);
create policy "HSE and root can add permit files" on public.permit_files
  for insert with check (public.active_role() in ('root', 'hse'));

-- ---------------------------------------------------------------
-- 5. YOU: make your own account Root and activate it.
--    Run this separately, with YOUR Staff ID (the part before @ in
--    Authentication -> Users). Example for Staff ID 18457:
--
--   update public.profiles set role = 'root', status = 'active', display_name = 'Your Name'
--    where staff_id = '18457';
--
--    To let everyone who already has an account sign in as an ordinary
--    user (view only), run:
--
--   update public.profiles set status = 'active' where status = 'pending' and role = 'permit_user';
--
--    To make someone HSE (can add permits and files):
--
--   update public.profiles set role = 'hse', status = 'active' where staff_id = '12345';
-- ---------------------------------------------------------------
