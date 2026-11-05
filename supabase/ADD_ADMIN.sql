-- Run in the SQL Editor of the SAME Supabase project used by the dashboard.
-- The Auth account must already exist. This grants access to every dashboard module.
-- To enroll a different administrator, replace the email below.
do $$
declare
  admin_email text := 'wawamunnohenry14@gmail.com';
  admin_user_id uuid;
begin
  select id into admin_user_id from auth.users
  where lower(email) = lower(trim(admin_email));

  if admin_user_id is null then
    raise exception 'No Auth user found for %. Check the email and selected Supabase project.', admin_email;
  end if;

  insert into public.hero_slider_admins (user_id)
  values (admin_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- The enrolled account should appear here after the block succeeds.
select u.id, u.email, a.created_at as administrator_since
from public.hero_slider_admins a
join auth.users u on u.id = a.user_id
order by a.created_at;
