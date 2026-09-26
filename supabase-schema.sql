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
--    created. Self-serve signup (see the /signup page and
--    lib/staffAuth.js) creates the Supabase auth account under the
--    person's REAL company email first — that's the only address
--    Supabase's free mailer can actually deliver a confirmation
--    email to — and passes their chosen staff_id in the signup
--    call's user_metadata, so it's available here immediately, at
--    insert time, before the app later swaps the account's login
--    email over to the synthetic staff-ID address. Falls back to
--    splitting the login email (old behavior) for any account you
--    still add by hand from the dashboard using the synthetic
--    address directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, staff_id, email)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'staff_id', split_part(new.email, '@', 1))),
    case when new.email like '%@staff.permit-log.internal' then null else new.email end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Accounts are now self-serve — see the /signup and
--    /forgot-password pages. Nothing to do here per person anymore.
--    To promote someone to HSE admin:
--
-- update public.profiles set role = 'admin' where staff_id = '18489';
--
--    Two one-time settings in the Supabase Dashboard make signup and
--    password reset work (both free, no extra service):
--      a) Authentication -> Providers -> Email -> "Confirm email"
--         must be ON (it is by default), so new accounts can't sign
--         in until the person clicks the link in their company inbox.
--      b) Authentication -> Emails -> "Reset Password" template:
--         add {{ .Token }} somewhere in the body so the email shows
--         a 6-digit code, not just a link — that code is what the
--         /forgot-password page's OTP field checks. (If you skip
--         this, the email still arrives with a working link, but
--         there's no code to type in.)
--
--    Old manual accounts (added straight from the dashboard with a
--    "<id>@staff.permit-log.internal" address and no real email) still
--    work exactly as before — just set their email afterwards:
--
-- update public.profiles set email = 'real.person@company.com' where staff_id = '18489';
--
--    Recovery snippet: the forgot-password flow briefly points an
--    account's login email at the person's real address so Supabase's
--    mailer can reach them, then points it back. If someone abandons
--    a reset partway through, their staff-ID login stops working
--    until either they finish a reset (self-heals automatically) or
--    you run this by hand:
--
-- update auth.users set email = (select staff_id from public.profiles where id = auth.users.id) || '@staff.permit-log.internal'
--  where id = (select id from public.profiles where staff_id = '18489');
