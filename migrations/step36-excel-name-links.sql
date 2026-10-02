-- Step 36: link accounts to the names used in the Excel log (Applicant /
-- Holder columns) so people can see "their" permits.
-- Run once in Supabase -> SQL Editor (safe to run again).
-- Run step33 and step35 first if you have not already.

-- One row per Excel name. An Excel name belongs to one account; one account
-- can own several names. The name is stored normalised: UPPER CASE with single
-- spaces (the app does this before saving).
create table if not exists public.excel_name_links (
  excel_name text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  linked_by uuid references public.profiles (id) on delete set null,
  linked_at timestamptz not null default now()
);

create index if not exists excel_name_links_user_idx on public.excel_name_links (user_id);

alter table public.excel_name_links enable row level security;

-- People read their own links (that is how the dashboard knows which permits
-- are theirs); Root and HSE read all of them. Changes are made by the server
-- with the service key, after it has checked the admin's permission.
drop policy if exists "People can read their own name links" on public.excel_name_links;
create policy "People can read their own name links"
  on public.excel_name_links for select
  using (user_id = auth.uid());

drop policy if exists "Root and HSE can read all name links" on public.excel_name_links;
create policy "Root and HSE can read all name links"
  on public.excel_name_links for select
  using (public.active_role() in ('root', 'hse'));
