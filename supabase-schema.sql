-- Permit Log Register — database setup.
-- Run in Supabase → SQL Editor → New query. Safe to re-run any time:
-- everything uses "if not exists" / "or replace" / "drop ... if exists".
-- Existing installs are upgraded in place (old 'admin' -> 'hse',
-- old 'user' -> 'permit_holder').

-- ---------------------------------------------------------------
-- 1. Profiles: one row per account (identity, role, status)
-- ---------------------------------------------------------------
-- role:   root | manager | hse | permit_user
--         (permit_user = applicants and holders; which part someone plays is
--         per permit, from the Excel columns, not an account role)
--         (what each role may do lives in lib/permissions.js)
-- status: pending | active | disabled — only 'active' accounts can use
--         the site. Accounts you add in the Supabase dashboard are active.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  display_name text,
  role text not null default 'permit_user',
  status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles drop column if exists email;

-- Role upgrade (step 21). Order matters: drop the old rule, convert the
-- rows, then add the new rule.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'hse' where role = 'admin';
update public.profiles set role = 'permit_user' where role in ('user', 'permit_holder', 'permit_applicant');
alter table public.profiles alter column role set default 'permit_user';
alter table public.profiles add constraint profiles_role_check
  check (role in ('root', 'manager', 'hse', 'permit_user'));

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
-- Accounts created from the app's "Create account" page carry
-- status / display_name in app_metadata (writable only from the server),
-- so they start as 'pending'. Every new account is a permit_user; only
-- Root can change a role later. Accounts you add in the dashboard have no
-- such metadata and start 'active'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, staff_id, display_name, role, status)
  values (
    new.id,
    split_part(new.email, '@', 1),
    nullif(meta->>'display_name', ''),
    'permit_user',
    case when meta->>'status' = 'pending' then 'pending' else 'active' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Step 22.1: requests made before roles were removed from the form may
-- carry a role; reset pending accounts to the ordinary role.
update public.profiles set role = 'permit_user' where status = 'pending';

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

-- Root can read every profile (needed for the admin pages).
drop policy if exists "Root can read all profiles" on public.profiles;
create policy "Root can read all profiles"
  on public.profiles for select
  using (public.active_role() = 'root');

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

-- Step 27: manual clean-up of old archived permits (and, in the app
-- layer, their attachments) so free-tier storage doesn't grow forever.
drop policy if exists "HSE and root can delete archive" on public.archived_permits;
create policy "HSE and root can delete archive"
  on public.archived_permits for delete
  using (public.active_role() in ('root', 'hse'));

-- ---------------------------------------------------------------
-- 6. Forgot-password requests (no email: they show up in Admin ->
--    Password requests). Only one open request per Staff ID.
--    Written by the server (service key); only Root can read them.
-- ---------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create unique index if not exists password_reset_one_open_per_staff
  on public.password_reset_requests (staff_id) where status = 'open';

alter table public.password_reset_requests enable row level security;

drop policy if exists "Root can read password requests" on public.password_reset_requests;
create policy "Root can read password requests"
  on public.password_reset_requests for select
  using (public.active_role() = 'root');

-- ---------------------------------------------------------------
-- 7. Rate limiting for the public forms (service key only: RLS is on
--    and no policy exists, so browsers can never touch this table).
-- ---------------------------------------------------------------
create table if not exists public.rate_limits (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_bucket_idx
  on public.rate_limits (bucket, created_at);

alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------
-- 8. Activity log (step 24). One tiny row per page visit, written by
--    touch_activity() (called from middleware, at most once per page
--    change or every 3 minutes). Old rows are purged inside that same
--    function now and then, so no cron job is needed. The tables stay Root-only
--    at database level; Root and HSE see them on the Activity page, which
--    reads with the server key after checking view_activity (step 25).
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists last_path text;

create table if not exists public.user_activity (
  id bigserial primary key,
  staff_id text not null,
  path text not null,
  at timestamptz not null default now()
);

create index if not exists user_activity_at_idx on public.user_activity (at desc);
create index if not exists user_activity_staff_idx on public.user_activity (staff_id, at desc);

alter table public.user_activity enable row level security;

drop policy if exists "Root can read activity" on public.user_activity;
create policy "Root can read activity"
  on public.user_activity for select
  using (public.active_role() = 'root');

-- One row: how many days of log to keep (3, 5 or 7). Root changes it on
-- the Activity page (saved by the server with the service key).
create table if not exists public.activity_settings (
  id int primary key check (id = 1),
  retention_days int not null default 7 check (retention_days in (3, 5, 7))
);

insert into public.activity_settings (id, retention_days) values (1, 7)
  on conflict (id) do nothing;

alter table public.activity_settings enable row level security;

drop policy if exists "Root can read activity settings" on public.activity_settings;
create policy "Root can read activity settings"
  on public.activity_settings for select
  using (public.active_role() = 'root');

-- Records the caller's own visit (auth.uid() only, so nobody can log or
-- change anything for someone else) and occasionally purges old rows.
create or replace function public.touch_activity(p_path text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_staff text;
  v_days int;
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_seen_at = now(), last_path = left(p_path, 200)
   where id = auth.uid() and status = 'active'
  returning staff_id into v_staff;

  if v_staff is null then
    return;
  end if;

  insert into public.user_activity (staff_id, path)
  values (v_staff, left(p_path, 200));

  -- About 1 visit in 50 also deletes expired rows.
  if random() < 0.02 then
    select retention_days into v_days from public.activity_settings where id = 1;
    delete from public.user_activity
     where at < now() - make_interval(days => coalesce(v_days, 7));
  end if;
end;
$$;

revoke all on function public.touch_activity(text) from public;
revoke all on function public.touch_activity(text) from anon;
grant execute on function public.touch_activity(text) to authenticated;

-- ===============================================================
-- Step 35: upload log + Staff ID change requests (see
-- migrations/step35-profile-and-upload-log.sql)
-- ===============================================================
-- ---------------------------------------------------------------
-- 1. Upload log: one row per upload attempt on the Upload page
--    (who, which file, when, size, result). Written by the server with
--    the service key; Root and HSE may read it.
-- ---------------------------------------------------------------
create table if not exists public.upload_log (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.profiles (id) on delete set null,
  staff_id text,               -- copy kept so the row still reads well if the account is deleted
  display_name text,
  file_name text not null,
  size_bytes bigint not null default 0,
  permit_count integer,        -- permits found in the file
  archived_count integer,      -- permits moved to the archive by this upload
  status text not null default 'uploaded' check (status in ('uploaded', 'rejected')),
  note text,                   -- why a file was rejected, or a warning
  created_at timestamptz not null default now()
);

create index if not exists upload_log_created_idx on public.upload_log (created_at desc);

alter table public.upload_log enable row level security;

drop policy if exists "Root and HSE can read upload log" on public.upload_log;
create policy "Root and HSE can read upload log"
  on public.upload_log for select
  using (public.active_role() in ('root', 'hse'));

-- ---------------------------------------------------------------
-- 2. Staff ID change requests. A person asks for a new Staff ID from
--    My profile; Root or Manager approves in Admin -> Staff ID changes.
--    Written by the server (service key). People can read their own rows.
-- ---------------------------------------------------------------
create table if not exists public.staff_id_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  old_staff_id text not null,
  new_staff_id text not null,
  reason text,
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'cancelled')),
  decision_note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

-- One open request per person, and nobody else can ask for the same new ID
-- while it is open.
create unique index if not exists staff_id_change_one_open_per_user
  on public.staff_id_change_requests (user_id) where status = 'open';
create unique index if not exists staff_id_change_one_open_per_new_id
  on public.staff_id_change_requests (new_staff_id) where status = 'open';
create index if not exists staff_id_change_requested_idx
  on public.staff_id_change_requests (requested_at desc);

alter table public.staff_id_change_requests enable row level security;

drop policy if exists "People can read their own ID change requests" on public.staff_id_change_requests;
create policy "People can read their own ID change requests"
  on public.staff_id_change_requests for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 3. Applying an approved change. One function = all or nothing: if any
--    step fails, nothing is changed. Attachments and archived permits
--    point to the account's internal id, so they follow automatically; the
--    places that store the Staff ID as text are rewritten here so the
--    history belongs to the new ID.
--    Callable with the service key only (the app checks permission first).
-- ---------------------------------------------------------------
create or replace function public.apply_staff_id_change(p_request_id uuid, p_decided_by uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  r public.staff_id_change_requests%rowtype;
  v_current text;
begin
  select * into r
    from public.staff_id_change_requests
   where id = p_request_id
   for update;
  if not found or r.status <> 'open' then
    raise exception 'Request not found or already handled';
  end if;

  select staff_id into v_current
    from public.profiles
   where id = r.user_id
   for update;
  if v_current is null then
    raise exception 'That account no longer exists';
  end if;
  if v_current <> r.old_staff_id then
    raise exception 'The Staff ID changed since this request was made';
  end if;
  if exists (
    select 1 from public.profiles
     where staff_id = r.new_staff_id and id <> r.user_id
  ) then
    raise exception 'That Staff ID is already used by another account';
  end if;

  update public.profiles            set staff_id = r.new_staff_id where id = r.user_id;
  update public.user_activity       set staff_id = r.new_staff_id where staff_id = v_current;
  update public.password_reset_requests
                                    set staff_id = r.new_staff_id where staff_id = v_current;
  update public.upload_log          set staff_id = r.new_staff_id where uploaded_by = r.user_id;

  update public.staff_id_change_requests
     set status = 'approved', decided_at = now(), decided_by = p_decided_by
   where id = r.id;

  return r.new_staff_id;
end;
$$;

revoke all on function public.apply_staff_id_change(uuid, uuid) from public;
revoke all on function public.apply_staff_id_change(uuid, uuid) from anon;
revoke all on function public.apply_staff_id_change(uuid, uuid) from authenticated;
grant execute on function public.apply_staff_id_change(uuid, uuid) to service_role;
