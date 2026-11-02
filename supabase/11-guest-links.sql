-- Step 11: GUEST LINKS. Root creates a link; whoever opens it and presses Start gets a
-- READ-ONLY view of the site for a limited time, with no login.
--
-- How it is kept safe (all of it inside the database, not only on screen):
--   * A guest is a temporary account with the new role 'guest'. It is created when Start is
--     pressed and has an end time (profiles.guest_expires_at).
--   * active_role() returns nothing for a guest whose time is over (or who was revoked), so
--     every read rule that depends on it stops returning data at that moment.
--   * Guests can read permits (like any signed-in role) but NOT attachments and NOT the
--     dropdown lists. They cannot add or change anything: those rules need root or hse.
--   * Only a scrambled (hashed) copy of each link is stored, never the link itself.
--
-- Safe to run more than once. Run it BEFORE deploying the code. No permit data is changed.

-- 1. The 'guest' role, and when a guest's time is over.
alter table public.profiles add column if not exists guest_expires_at timestamptz;

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%permit_user%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('root', 'manager', 'hse', 'permit_user', 'guest'));

-- 2. A guest only counts while their time has not run out.
create or replace function public.active_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid()
    and status = 'active'
    and (role <> 'guest' or (guest_expires_at is not null and guest_expires_at > now()))
$$;

-- 3. Guests cannot read attachments or the dropdown lists (these were "any signed-in role").
drop policy if exists "Signed-in users can read permit files" on public.permit_files;
create policy "Signed-in users can read permit files" on public.permit_files
  for select using (public.active_role() is not null and public.active_role() <> 'guest');

drop policy if exists "Signed-in users can read options" on public.permit_options;
create policy "Signed-in users can read options" on public.permit_options
  for select using (public.active_role() is not null and public.active_role() <> 'guest');

-- 4. The links themselves. Only the server (service key) writes here; only Root can read.
create table if not exists public.guest_links (
  id bigint generated always as identity primary key,
  label text not null,
  token_hash text not null unique,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  link_valid_until timestamptz not null,   -- the link can be opened until this time
  session_minutes integer not null check (session_minutes between 1 and 1440),
  opened_at timestamptz,                   -- set when Start is pressed (the link is then used up)
  expires_at timestamptz,                  -- opened_at + session_minutes
  revoked_at timestamptz,
  guest_user_id uuid
);

alter table public.guest_links enable row level security;

drop policy if exists "Root can read guest links" on public.guest_links;
create policy "Root can read guest links" on public.guest_links
  for select using (public.active_role() = 'root');
-- No insert / update / delete rule: only the server's service key changes this table.
