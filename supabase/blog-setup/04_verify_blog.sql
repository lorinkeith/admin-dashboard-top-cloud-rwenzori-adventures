-- Read-only installation and conflict checks.
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'blog_%';
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where (schemaname='public' and tablename like 'blog_%') or (schemaname='storage' and policyname like 'topcloud_blog_%');
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='blog-images';
select count(*) as existing_administrators from public.hero_slider_admins;
select column_name from information_schema.columns where table_schema='public' and table_name='topcloud_public_blog_comments';
