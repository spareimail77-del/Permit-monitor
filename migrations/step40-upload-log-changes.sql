-- Step 40: the upload log records what each upload changed.
-- Run once in Supabase -> SQL Editor. Safe to run again.
--
-- added_count / updated_count / removed_count  compared with the file that was
--   on the site before (null on the first upload, or if it could not be read)
-- changes  capped list (JSON): permit numbers added / removed, and for updated
--   permits which fields changed (old -> new). Counts are always exact; the
--   lists keep at most 100 permit numbers per group.

alter table public.upload_log add column if not exists added_count integer;
alter table public.upload_log add column if not exists updated_count integer;
alter table public.upload_log add column if not exists removed_count integer;
alter table public.upload_log add column if not exists changes jsonb;
