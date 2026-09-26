-- Run this ONCE, in your Supabase project → SQL Editor → New query.
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- 1. One row per signed-up user, holding app-level role + permissions.
--    'permissions' is a free-form jsonb object, kept empty for now —
--    it's the room to add finer-grained flags later (e.g.
--    {"can_export": true}) without another migration.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
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
-- purpose — role changes are made by you, the project owner, from
-- the Supabase dashboard or SQL editor, which uses the service role
-- and bypasses RLS. The app's anon/browser client can never grant
-- itself admin.

-- 2. Auto-create a 'user'-role profile row whenever someone signs up,
--    so you never have to insert one by hand.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. After creating your first account (Supabase Dashboard →
--    Authentication → Users → Add user), promote it to admin:
--
-- update public.profiles set role = 'admin' where email = 'you@example.com';
