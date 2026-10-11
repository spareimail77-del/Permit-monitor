-- STEP C: edit, close, cancel and delete permits; delete attachments; manage the
-- dropdown lists. Run ONCE in Supabase -> SQL Editor (after 01 to 04). Safe to run again.
--
-- Until now the database refused every change and every delete. This adds, for
-- Root and HSE only (public.active_role() is null for everyone else):
--   * edit permits (update)         * delete permits (delete)
--   * delete attachment records      * add and hide/show dropdown values
-- Deleting a permit also removes its attachment rows (the foreign key already
-- cascades); the files in Cloudinary are removed by the site.

drop policy if exists "HSE and root can edit permits" on public.permits;
create policy "HSE and root can edit permits" on public.permits
  for update
  using (public.active_role() in ('root', 'hse'))
  with check (public.active_role() in ('root', 'hse'));

drop policy if exists "HSE and root can delete permits" on public.permits;
create policy "HSE and root can delete permits" on public.permits
  for delete using (public.active_role() in ('root', 'hse'));

drop policy if exists "HSE and root can delete permit files" on public.permit_files;
create policy "HSE and root can delete permit files" on public.permit_files
  for delete using (public.active_role() in ('root', 'hse'));

drop policy if exists "HSE and root can add options" on public.permit_options;
create policy "HSE and root can add options" on public.permit_options
  for insert with check (public.active_role() in ('root', 'hse'));

drop policy if exists "HSE and root can change options" on public.permit_options;
create policy "HSE and root can change options" on public.permit_options
  for update
  using (public.active_role() in ('root', 'hse'))
  with check (public.active_role() in ('root', 'hse'));
-- Dropdown values are never deleted, only hidden (they stay on old permits).
