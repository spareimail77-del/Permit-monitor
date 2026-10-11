-- STEP B2: users admin. Run ONCE in Supabase -> SQL Editor, BEFORE deploying the
-- B2 code (the new middleware reads a column created here). Safe to run again.
--
-- What it does:
--   1. profiles gets must_change_password (set when Root hands out a temporary password)
--   2. password_reset_requests  (forgot-password requests, shown to Root)
--   3. staff_id_change_requests (Staff ID change requests, decided by Root)
--   4. rate_limits + hit_rate_limit() (limits on the public register/forgot forms)
--   5. a safety lock: the last active Root can never be changed or removed

-- 1 ----------------------------------------------------------------
alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- 2 ----------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id bigint generated always as identity primary key,
  staff_id text not null,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz
);
-- One open request per person.
create unique index if not exists password_reset_one_open
  on public.password_reset_requests (staff_id) where status = 'open';
alter table public.password_reset_requests enable row level security;
-- No policies on purpose: only the server (service role key) reads or writes this table.

-- 3 ----------------------------------------------------------------
create table if not exists public.staff_id_change_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  old_staff_id text not null,
  new_staff_id text not null,
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'cancelled')),
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
create unique index if not exists staff_id_change_one_open_per_user
  on public.staff_id_change_requests (user_id) where status = 'open';
create unique index if not exists staff_id_change_one_open_per_new_id
  on public.staff_id_change_requests (new_staff_id) where status = 'open';
alter table public.staff_id_change_requests enable row level security;

drop policy if exists "Read own staff id requests" on public.staff_id_change_requests;
create policy "Read own staff id requests" on public.staff_id_change_requests
  for select using (user_id = auth.uid());
-- Writes: server only (service role key).

-- 4 ----------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;

-- true = allowed, false = too many in this window.
create or replace function public.hit_rate_limit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rate_limits;
begin
  insert into public.rate_limits as rl (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                then 1 else rl.hits + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else rl.window_start end
  returning * into r;

  delete from public.rate_limits where window_start < now() - interval '2 days';
  return r.hits <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- 5 ----------------------------------------------------------------
create or replace function public.protect_last_root()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role = 'root' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'root' or new.status <> 'active') then
    if not exists (
      select 1 from public.profiles
      where role = 'root' and status = 'active' and id <> old.id
    ) then
      raise exception 'The last active Root cannot be changed or removed.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_root on public.profiles;
create trigger protect_last_root
  before update or delete on public.profiles
  for each row execute procedure public.protect_last_root();
