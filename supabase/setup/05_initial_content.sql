-- Intentionally no business/customer/review/auth data from the reference.
-- Top Cloud default content lives in its frontend until the first admin publish.
insert into public.homepage_customizations(page_key) values ('home') on conflict (page_key) do nothing;
