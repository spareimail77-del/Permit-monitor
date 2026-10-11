-- STEP C2: recycle bin. Run ONCE in Supabase -> SQL Editor (after 01 to 05). Safe to run again.
--
-- "Delete permit" no longer erases anything: it sets deleted_at. The permit then
-- disappears for everyone except Root and HSE, who can see it in the Trash.
--   * Root and HSE: see the trash, restore (update)
--   * Root only: delete permanently (the only delete rule on permits)
-- Files stay in Cloudinary until Root deletes the permit permanently.

alter table public.permits add column if not exists deleted_at timestamptz;
alter table public.permits add column if not exists deleted_by text;
create index if not exists permits_deleted_idx on public.permits (deleted_at) where deleted_at is not null;

-- Who can read permits: everyone active sees permits that are NOT in the trash;
-- Root and HSE also see the ones that are.
drop policy if exists "Signed-in users can read permits" on public.permits;
create policy "Signed-in users can read permits" on public.permits
  for select using (
    public.active_role() is not null
    and (deleted_at is null or public.active_role() in ('root', 'hse'))
  );

-- A file is readable only if its permit is readable (so files of trashed permits
-- are hidden from Manager and Permit user too).
drop policy if exists "Signed-in users can read permit files" on public.permit_files;
create policy "Signed-in users can read permit files" on public.permit_files
  for select using (
    public.active_role() is not null
    and exists (select 1 from public.permits p where p.id = permit_files.permit_id)
  );

-- Permanent delete: Root only (replaces the Root-and-HSE rule from step C).
drop policy if exists "HSE and root can delete permits" on public.permits;
drop policy if exists "Root can delete permits" on public.permits;
create policy "Root can delete permits" on public.permits
  for delete using (public.active_role() = 'root');
