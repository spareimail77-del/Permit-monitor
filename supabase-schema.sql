-- Run this ONCE, in your Supabase project → SQL Editor → New query.
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- 1. One row per signed-up user, holding app-level identity + role.
--    - staff_id: what people actually log in with (e.g. "18489").
--    - email: their REAL email, for communication only — never used
--      to sign in, and left blank until you fill it in (step 3).
--    - permissions: free-form jsonb, empty for now — room to add
--      finer-grained flags later (e.g. {"can_export": true}) without
--      another migration.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  staff_id text unique,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
