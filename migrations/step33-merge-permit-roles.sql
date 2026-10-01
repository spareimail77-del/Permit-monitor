-- Step 33: "Permit holder" and "Permit applicant" become one role,
-- "Permit user". Run once in Supabase -> SQL Editor, BEFORE deploying the
-- matching code (the code also understands the old values, so deploying first
-- is harmless, but picking "Permit user" in Admin -> Users needs this run).
-- Safe to run again.

alter table public.profiles drop constraint if exists profiles_role_check;

update public.profiles
   set role = 'permit_user'
 where role in ('permit_holder', 'permit_applicant');

alter table public.profiles alter column role set default 'permit_user';

alter table public.profiles add constraint profiles_role_check
  check (role in ('root', 'manager', 'hse', 'permit_user'));

-- New sign-ups get the new role too.
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
    case when meta->>'status' = 'pending' then 'pending' else 'active' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
