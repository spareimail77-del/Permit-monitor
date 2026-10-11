-- STEP A: database for the permit form.
-- Run ONCE in Supabase -> SQL Editor (a NEW Supabase project is fine). Safe to run again.

-- ---------------------------------------------------------------
-- permits: one row per permit
-- ---------------------------------------------------------------
create table if not exists public.permits (
  id bigint generated always as identity primary key,
  reference text not null,
  area text not null default '',
  location text not null default '',
  permit_type text not null default '',
  job_description text not null default '',
  certificates text not null default '',      -- several certificates, one per line
  certificate_no text not null default '',
  applicant text not null default '',
  holder text not null default '',
  issuer text not null default '',
  area_authority text not null default '',
  controller text not null default '',
  valid_from date,
  valid_to date,
  -- Only what a person decides is stored. Overdue / Expiring Soon are worked
  -- out by the site from valid_to (a later step).
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'CANCELED')),
  closed_at date,
  cancel_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A permit number can be used once (upper/lower case and spaces ignored).
create unique index if not exists permits_reference_uniq
  on public.permits (upper(btrim(reference)));

-- ---------------------------------------------------------------
-- permit_options: the dropdown lists of the form
-- ---------------------------------------------------------------
create table if not exists public.permit_options (
  id bigint generated always as identity primary key,
  list text not null check (list in
    ('area', 'permit_type', 'certificate', 'applicant', 'holder', 'issuer', 'controller')),
  value text not null,
  active boolean not null default true,        -- hidden values stay on old permits
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists permit_options_uniq
  on public.permit_options (list, upper(btrim(value)));

-- Starting lists, copied from the Excel DropdownRAW sheet.
insert into public.permit_options (list, value, sort) values
  ('area','CCS',10),
  ('area','TSE',20),
  ('permit_type','COLD',10),
  ('permit_type','COLD BLANKET',20),
  ('permit_type','HOT',30),
  ('certificate','CONFINED SPACE ENTRY',10),
  ('certificate','ELECTRICAL ISOLATION',20),
  ('certificate','EXCAVATION',30),
  ('certificate','HEAVY EQUIPMENT LIFTING',40),
  ('certificate','MECHANICAL ISOLATION / DE-ISOLATION',50),
  ('certificate','NA',60),
  ('certificate','WORK AT HEIGHT',70),
  ('certificate','WORK AT NIGHT',80),
  ('applicant','AKSHITH',10),
  ('applicant','BALAKRISHNAN',20),
  ('applicant','MADHU',30),
  ('applicant','NISHANTH K',40),
  ('holder','ABRAHAM',10),
  ('holder','MIJO JOHN',20),
  ('holder','RAJESH',30),
  ('holder','NISHANTH K',40),
  ('holder','AKSHITH',50),
  ('issuer','HAMID SAID AL AWAID',10),
  ('issuer','AHMED ALAMRI',20),
  ('issuer','ALI BA OMAR',30),
  ('issuer','AQEEL BAOMAR',40),
  ('issuer','HAITHAM EIDROOS',50),
  ('issuer','HAMID JABOOB',60),
  ('issuer','MOHAMMAD BAQI',70),
  ('issuer','SAID AL ZAWAMRI',80),
  ('controller','MD SAHIL MALEK',10)
on conflict do nothing;

-- ---------------------------------------------------------------
-- TEMPORARY ACCESS (step A only, there is no login yet)
-- Anyone who has the site address can read and add permits.
-- Step B adds login and REPLACES these policies with role-based ones.
-- Until then: do not share the site address and do not enter real data.
-- ---------------------------------------------------------------
alter table public.permits enable row level security;
alter table public.permit_options enable row level security;

drop policy if exists "TEMP step A: read permits" on public.permits;
create policy "TEMP step A: read permits" on public.permits for select using (true);

drop policy if exists "TEMP step A: add permits" on public.permits;
create policy "TEMP step A: add permits" on public.permits for insert with check (true);

drop policy if exists "TEMP step A: read options" on public.permit_options;
create policy "TEMP step A: read options" on public.permit_options for select using (true);
-- No update or delete policy: nothing can be changed or removed from the site yet.
