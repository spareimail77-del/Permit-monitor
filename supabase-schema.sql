-- Permit Log Register — database setup.
-- Run in Supabase → SQL Editor → New query. Safe to re-run any time:
-- everything uses "if not exists" / "or replace" / "drop ... if exists".
-- Existing installs are upgraded in place (old 'admin' -> 'hse',
-- old 'user' -> 'permit_holder').

-- ---------------------------------------------------------------
-- 1. Profiles: one row per account (identity, role, status)
-- ---------------------------------------------------------------
-- role:   root | manager | hse | permit_holder | permit_applicant
--         (what each role may do lives in lib/permissions.js)
-- status: pending | active | disabled — only 'active' accounts can use
--         the site. Accounts you add in the Supabase dashboard are active.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  display_name text,
  role text not null default 'permit_holder',
  status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles drop column if exists email;

-- Role upgrade (step 21). Order matters: drop the old rule, convert the
-- rows, then add the new rule.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'hse' where role = 'admin';
update public.profiles set role = 'permit_holder' where role = 'user';
alter table public.profiles alter column role set default 'permit_holder';
alter table public.profiles add constraint profiles_role_check
  check (role in ('root', 'manager', 'hse', 'permit_holder', 'permit_applicant'));

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'active', 'disabled'));

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);
-- No insert/update/delete policy for regular users on purpose: nobody
-- can change their own role or status from the browser.

-- Make YOURSELF root (edit the staff ID, then run just this statement):
--
-- update public.profiles set role = 'root' where staff_id = '18489';

-- ---------------------------------------------------------------
-- 2. New account -> profile row (staff_id comes from the login address,
--    e.g. 18489@staff.permit-log.internal -> '18489')
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, staff_id)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Adding an account by hand (Supabase → Authentication → Users → Add user):
--   Email: <staff id>@staff.permit-log.internal  (never emailed)
--   Password: anything; tick "Auto Confirm User".
--   Then set role / name if needed:
--
-- update public.profiles set role = 'hse', display_name = 'Jeff'
--  where staff_id = '18489';

-- ---------------------------------------------------------------
-- 3. Helper used by the policies below: the caller's role, but only
--    while their account is active (otherwise null = no access).
-- ---------------------------------------------------------------
create or replace function public.active_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

-- ---------------------------------------------------------------
-- 4. Attachments (metadata here, file bytes in Cloudinary), keyed by
--    permit number because Excel row numbers shift on every upload.
-- ---------------------------------------------------------------
create table if not exists public.permit_attachments (
  id uuid primary key default gen_random_uuid(),
  permit_reference text not null,
  label text not null,
  file_name text not null,
  storage_key text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists permit_attachments_reference_idx
  on public.permit_attachments (permit_reference);

alter table public.permit_attachments enable row level security;

drop policy if exists "Signed-in users can read attachments" on public.permit_attachments;
create policy "Signed-in users can read attachments"
  on public.permit_attachments for select
  using (public.active_role() is not null);

drop policy if exists "Admins can add attachments" on public.permit_attachments;
drop policy if exists "HSE and root can add attachments" on public.permit_attachments;
create policy "HSE and root can add attachments"
  on public.permit_attachments for insert
  with check (public.active_role() in ('root', 'hse'));

drop policy if exists "Admins can delete attachments" on public.permit_attachments;
drop policy if exists "HSE and root can delete attachments" on public.permit_attachments;
create policy "HSE and root can delete attachments"
  on public.permit_attachments for delete
  using (public.active_role() in ('root', 'hse'));

-- ---------------------------------------------------------------
-- 5. Permit archive: permits that dropped out of the Excel. One row
--    per permit number, so daily uploads never duplicate.
-- ---------------------------------------------------------------
create table if not exists public.archived_permits (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  area text,
  location text,
  permit_type text,
  job_description text,
  holder text,
  applicant text,
  valid_from date,
  valid_to date,
  excel_status text,
  data jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles (id) on delete set null
);

create index if not exists archived_permits_archived_at_idx
  on public.archived_permits (archived_at desc);

alter table public.archived_permits enable row level security;

-- Root, HSE and Manager can read; only Root and HSE can write.
drop policy if exists "Admins can read archive" on public.archived_permits;
drop policy if exists "Staff can read archive" on public.archived_permits;
create policy "Staff can read archive"
  on public.archived_permits for select
  using (public.active_role() in ('root', 'hse', 'manager'));

drop policy if exists "Admins can add to archive" on public.archived_permits;
drop policy if exists "HSE and root can add to archive" on public.archived_permits;
create policy "HSE and root can add to archive"
  on public.archived_permits for insert
  with check (public.active_role() in ('root', 'hse'));

-- The app saves with "upsert", which needs update as well.
drop policy if exists "Admins can update archive" on public.archived_permits;
drop policy if exists "HSE and root can update archive" on public.archived_permits;
create policy "HSE and root can update archive"
  on public.archived_permits for update
  using (public.active_role() in ('root', 'hse'));
