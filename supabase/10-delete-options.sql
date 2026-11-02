-- Step 10: Root and HSE can delete a value from the other dropdown lists too
-- (Area, Type of permit, Certificates, Applicant, Holder, Issuer, Controller).
-- The Location list stays Root only (supabase/09-location-delete.sql).
--
-- Permits keep the TEXT they were saved with, so deleting (or renaming) a value never
-- changes an existing permit; it only changes what the dropdown offers from now on.
-- Safe to run more than once. Run 09 first.

drop policy if exists "HSE and root can delete options" on public.permit_options;
create policy "HSE and root can delete options" on public.permit_options
  for delete using (list <> 'location' and public.active_role() in ('root', 'hse'));
