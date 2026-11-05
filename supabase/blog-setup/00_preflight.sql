-- Read only. Review against the actual project before running installation scripts.
select current_database(), current_user;
select to_regprocedure('public.is_admin()') as existing_admin_function,
       to_regclass('public.hero_slider_admins') as existing_admin_allowlist;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and (table_name like 'blog_%' or table_name='topcloud_public_blog_comments')
order by table_name,ordinal_position;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename like 'blog_%') or schemaname='storage';
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='blog-images';
select n.nspname,p.proname,pg_get_functiondef(p.oid) from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_admin','topcloud_blog_updated_at');
