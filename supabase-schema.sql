-- Run this ONCE, in your Supabase project → SQL Editor → New query.
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- 1. One row per signed-up user, holding app-level identity + role.
--    - staff_id: what people actually log in with (e.g. "18489").
--    - display_name: the friendly name shown in the navbar (e.g.
--      "Jeff") instead of the raw staff_id. Blank until you set it
--      (step 3b) — the app falls back to showing the staff_id.
--    - permissions: free-form jsonb, empty for now — room to add
--      finer-grained flags later (e.g. {"can_export": true}) without
--      another migration.
--    There is deliberately no "real email" column — nothing in this
--    app sends email (no signup confirmation, no password-reset
--    email, no notifications), so there's nothing to store one for.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Existing installs: the line above only creates the column on a
-- brand-new table, so add it here too — safe to re-run either way.
alter table public.profiles add column if not exists display_name text;

-- Existing installs from before this step: drop the unused real-email
-- column. Safe to re-run — does nothing once it's already gone.
alter table public.profiles drop column if exists email;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- No insert/update/delete policy is defined for regular users on
-- purpose — role changes are made by you, the project owner, from
-- the Supabase dashboard or SQL editor, which uses the service role
-- and bypasses RLS. The app's anon/browser client can never grant
-- itself admin.

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
--       - IMPORTANT (free tier, no SMTP configured): tick
--         "Auto Confirm User" in that same "Add user" dialog. Without
--         it, Supabase tries to send a confirmation email to the
--         synthetic address above — that send fails (no SMTP set up)
--         and shows up as an auth error in Supabase's logs, even
--         though the account still half-works. Also confirm, once,
--         under Authentication -> Settings, that "Confirm email" is
--         turned off — same reason.
--    b) Back here, set their role if they're an HSE admin:
--
-- update public.profiles
--    set role = 'admin'
--  where staff_id = '18489';
--
--    Leave role as the default 'user' for everyone who should only
--    view the site.
--
--    c) Give them a friendly display name for the navbar, e.g.:
--
-- update public.profiles
--    set display_name = 'Jeff'
--  where staff_id = '18489';
--
--    Never use Supabase's "Invite user", "magic link", or
--    "send password reset email" actions for these accounts — all
--    three require SMTP, which the free tier doesn't have configured,
--    and will error. A forgotten password is reset manually instead:
--    Authentication -> Users -> (person) -> reset password.

-- 4. Attachments (Physical Permit scans, JSAs, or anything else an
--    admin uploads) — metadata only lives here; the actual file bytes
--    live in Cloudinary (set up separately, see README). Keyed by
--    permit_reference (the human "Permit No.", column B) rather than
--    the Excel row number, since row numbers shift on every re-upload
--    but the reference doesn't. Note: if two rows share a duplicate
--    reference (the app already flags this elsewhere), attachments
--    show under both — this mirrors how the app already treats
--    duplicate references.
--    "label" is free text the admin types at upload time (e.g.
--    "Physical Permit", "JSA", "Risk Assessment") — there's no fixed
--    list, so no check constraint here.
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

-- Existing installs from before this step: rename the old fixed-list
-- "kind" column to free-text "label" and drop its check constraint,
-- carrying over any existing values as-is. Guarded so it only runs
-- once, on a table that still has the old column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permit_attachments' and column_name = 'kind'
  ) then
    alter table public.permit_attachments drop constraint if exists permit_attachments_kind_check;
    alter table public.permit_attachments rename column kind to label;
  end if;
end $$;

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
