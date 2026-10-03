-- Step 38: accounts can only become active through Root.
-- Run once in Supabase -> SQL Editor. Safe to run again.
--
-- Before: an account created WITHOUT the server-side "pending" flag (for
-- example through Supabase's public sign-up endpoint, if sign-up was left
-- on) started 'active'. Now only an account created by the server with
-- app_metadata.status = 'active' starts active; everything else is
-- 'pending' until Root accepts it in Admin -> Users.
-- Existing accounts are NOT changed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, staff_id, display_name, role, status)
  values (
    new.id,
    split_part(new.email, '@', 1),
    nullif(meta->>'display_name', ''),
    'permit_user',
    case when meta->>'status' = 'active' then 'active' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
