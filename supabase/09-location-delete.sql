-- Step 9: Root can delete a location from the list (rename needs no SQL).
-- Permits keep their location TEXT, so deleting a location never changes an existing permit.
-- Safe to run more than once. Only the Location list can be deleted from; other lists are only hidden.

drop policy if exists "Root can delete locations" on public.permit_options;
create policy "Root can delete locations" on public.permit_options
  for delete using (list = 'location' and public.active_role() = 'root');
