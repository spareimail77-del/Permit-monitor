-- Step 35: upload log + "My profile" Staff ID change requests.
-- Run once in Supabase -> SQL Editor (safe to run again).
-- Run step33-merge-permit-roles.sql first if you have not already.

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
