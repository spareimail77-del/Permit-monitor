-- STEP A2: certificates with their own numbers, and file attachments.
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
-- permit_files: one row per attached file (the file itself is in Storage)
-- ---------------------------------------------------------------
create table if not exists public.permit_files (
  id bigint generated always as identity primary key,
  permit_id bigint not null references public.permits (id) on delete cascade,
  kind text not null check (kind in ('permit_copy', 'jsa', 'certificate', 'other')),
  label text not null default '',              -- certificate name, or what an "other" document is
  file_name text not null,
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists permit_files_permit_idx on public.permit_files (permit_id);

alter table public.permit_files enable row level security;

-- ---------------------------------------------------------------
-- Storage bucket (private; files are opened with short-lived links)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('permit-files', 'permit-files', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- ---------------------------------------------------------------
-- TEMPORARY ACCESS (step A only, there is no login yet)
-- Same as the permits table: step B replaces these with role-based policies.
-- ---------------------------------------------------------------
drop policy if exists "TEMP step A: read permit files" on public.permit_files;
create policy "TEMP step A: read permit files" on public.permit_files for select using (true);

drop policy if exists "TEMP step A: add permit files" on public.permit_files;
create policy "TEMP step A: add permit files" on public.permit_files for insert with check (true);

drop policy if exists "TEMP step A: read stored files" on storage.objects;
create policy "TEMP step A: read stored files" on storage.objects
  for select using (bucket_id = 'permit-files');

drop policy if exists "TEMP step A: add stored files" on storage.objects;
create policy "TEMP step A: add stored files" on storage.objects
  for insert with check (bucket_id = 'permit-files');
