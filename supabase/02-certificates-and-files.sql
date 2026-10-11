-- STEP A2: certificates with their own numbers, and the table of attached files.
-- Run ONCE in Supabase -> SQL Editor, after 01-permits.sql. Safe to run again.
--
-- WARNING: this removes the old certificate columns, so certificates typed on
-- any permit saved with step A are lost. Only test permits exist, so that is fine.

-- ---------------------------------------------------------------
-- certificates: a list of { name, number }, one number per certificate
-- ---------------------------------------------------------------
alter table public.permits drop column if exists certificate_no;
alter table public.permits drop column if exists certificates;
alter table public.permits add column certificates jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------
-- permit_files: one row per attached file (the file itself is in Cloudinary)
-- ---------------------------------------------------------------
create table if not exists public.permit_files (
  id bigint generated always as identity primary key,
  permit_id bigint not null references public.permits (id) on delete cascade,
  kind text not null check (kind in ('permit_copy', 'jsa', 'certificate', 'other')),
  label text not null default '',              -- certificate name, or what an "other" document is
  file_name text not null,
  storage_path text not null unique,           -- the file's name in Cloudinary
  content_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists permit_files_permit_idx on public.permit_files (permit_id);

alter table public.permit_files enable row level security;

-- ---------------------------------------------------------------
-- TEMPORARY ACCESS (step A only, there is no login yet)
-- Same as the permits table: step B replaces these with role-based policies.
-- The files themselves are in Cloudinary (see README); this table only records
-- which file belongs to which permit.
-- ---------------------------------------------------------------
drop policy if exists "TEMP step A: read permit files" on public.permit_files;
create policy "TEMP step A: read permit files" on public.permit_files for select using (true);

drop policy if exists "TEMP step A: add permit files" on public.permit_files;
create policy "TEMP step A: add permit files" on public.permit_files for insert with check (true);

-- Clean-up for anyone who ran the first version of this file, which used
-- Supabase Storage. Harmless otherwise. (If a "permit-files" bucket exists, delete
-- it in the Supabase dashboard -> Storage; SQL is not allowed to remove buckets.)
drop policy if exists "TEMP step A: read stored files" on storage.objects;
drop policy if exists "TEMP step A: add stored files" on storage.objects;
