-- PAPER COPY MISSING: a permit that is CLOSED but whose physical (paper) copy is lost.
-- The stored status stays CLOSED, so every count and filter still treats it as Closed.
-- Only the label changes: a "Paper missing" tag on the site and MISSING in the Excel export.
-- Run ONCE in Supabase -> SQL Editor, BEFORE deploying the code. Safe to run again.
alter table public.permits add column if not exists paper_missing boolean not null default false;
