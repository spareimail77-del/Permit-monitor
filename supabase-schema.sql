-- Run this ONCE, in your Supabase project → SQL Editor → New query.
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- 1. One row per signed-up user, holding app-level identity + role.
--    - staff_id: what people actually log in with (e.g. "18489").
--    - email: their REAL email, for communication only — never used
--      to sign in, and left blank until you fill it in (step 3).
--    - display_name: the friendly name shown in the navbar (e.g.
--      "Jeff") instead of the raw staff_id. Blank until you set it
--      (step 3b) — the app falls back to showing the staff_id.
--    - permissions: free-form jsonb, empty for now — room to add
--      finer-grained flags later (e.g. {"can_export": true}) without
--      another migration.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Existing installs: the line above only creates the column on a
-- brand-new table, so add it here too — safe to re-run either way.
alter table public.profiles add column if not exists display_name text;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- No insert/update/delete policy is defined for regular users on
-- purpose — role and email changes are made by you, the project
-- owner, from the Supabase dashboard or SQL editor, which uses the
-- service role and bypasses RLS. The app's anon/browser client can
-- never grant itself admin.

-- 2. Auto-create a 'user'-role profile row whenever an account is
--    created. staff_id is pulled straight out of the synthetic login
--    address you'll type when adding the user (see step 3), e.g.
--    "18489@staff.permit-log.internal" -> staff_id "18489" — so you
--    never have to type it twice.
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

-- 3. Creating a new HSE account (do this per person):
--    a) Supabase Dashboard -> Authentication -> Users -> Add user.
--       - Email: "<their staff id>@staff.permit-log.internal"
--         e.g. 18489@staff.permit-log.internal — this is never
--         emailed to anyone, it's just Supabase's required login ID.
--       - Password: whatever you assign them (they can change it
--         later via a "change password" feature if you add one).
--    b) Back here, fill in their real email and, if they're an HSE
--       admin, their role:
--
-- update public.profiles
--    set email = 'real.person@company.com', role = 'admin'
--  where staff_id = '18489';
--
--    Leave role as the default 'user' for everyone who should only
--    view the site.
--
--    b) Give them a friendly display name for the navbar, e.g.:
--
-- update public.profiles
--    set display_name = 'Jeff'
--  where staff_id = '18489';

-- 4. Attachments (Physical Permit scans, JSAs) — metadata only lives
--    here; the actual file bytes live in Backblaze B2 (set up
--    separately, see README). Keyed by permit_reference (the human
--    "Permit No.", column B) rather than the Excel row number, since
--    row numbers shift on every re-upload but the reference doesn't.
--    Note: if two rows share a duplicate reference (the app already
--    flags this elsewhere), attachments show under both — this
--    mirrors how the app already treats duplicate references.
create table if not exists public.permit_attachments (
  id uuid primary key default gen_random_uuid(),
  permit_reference text not null,
  kind text not null check (kind in ('physical_permit', 'jsa')),
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

-- Any signed-in user (admin or not) can see attachment metadata and
-- therefore view/download the file — per your instructions, "view
-- only" here means admin-only upload/delete, not a download block.
drop policy if exists "Signed-in users can read attachments" on public.permit_attachments;
create policy "Signed-in users can read attachments"
  on public.permit_attachments for select
  using (auth.uid() is not null);

drop policy if exists "Admins can add attachments" on public.permit_attachments;
create policy "Admins can add attachments"
  on public.permit_attachments for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admins can delete attachments" on public.permit_attachments;
create policy "Admins can delete attachments"
  on public.permit_attachments for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
