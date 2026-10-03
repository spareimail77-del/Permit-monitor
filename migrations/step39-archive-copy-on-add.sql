-- Step 39: the archive now copies every permit on upload (new and changed
-- ones) instead of guessing which permits were removed.
-- Run once in Supabase -> SQL Editor. Safe to run again.
--
-- in_log       true  = the permit is in the latest uploaded Excel file
--              false = it dropped out of the file (kept here for reference)
-- archived_at  now means "date the permit left the log" for in_log = false rows
-- fingerprint  short text used to spot changed permits (filled by the next upload)
-- updated_at   last time the archive copy was refreshed

alter table public.archived_permits add column if not exists fingerprint text;
alter table public.archived_permits add column if not exists in_log boolean not null default false;
alter table public.archived_permits add column if not exists updated_at timestamptz;

-- Every row that exists today was archived because it left the Excel file,
-- so in_log stays false for them. The next upload sets it to true for any
-- permit that is in the file again.
update public.archived_permits set updated_at = archived_at where updated_at is null;

create index if not exists archived_permits_in_log_idx
  on public.archived_permits (in_log, archived_at desc);
