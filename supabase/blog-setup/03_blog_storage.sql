begin;
do $$ begin
  if exists(select 1 from storage.buckets where id='blog-images') and
     not exists(select 1 from storage.buckets where id='blog-images' and name='blog-images' and public=true and file_size_limit=5242880 and allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[]) then
    raise exception 'Existing blog-images bucket has different settings. Inspect it before continuing; this script will not change it.';
  end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('blog-images','blog-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do nothing;
-- Public image URLs are permanent: do not upload confidential material.
drop policy if exists topcloud_blog_images_insert on storage.objects;
create policy topcloud_blog_images_insert on storage.objects for insert to authenticated with check ((bucket_id='blog-images' and (select public.is_admin()))) ;
drop policy if exists topcloud_blog_images_update on storage.objects;
create policy topcloud_blog_images_update on storage.objects for update to authenticated using ((bucket_id='blog-images' and (select public.is_admin()))) with check ((bucket_id='blog-images' and (select public.is_admin()))) ;
drop policy if exists topcloud_blog_images_delete on storage.objects;
create policy topcloud_blog_images_delete on storage.objects for delete to authenticated using ((bucket_id='blog-images' and (select public.is_admin()))) ;
drop policy if exists topcloud_blog_images_select on storage.objects;
create policy topcloud_blog_images_select on storage.objects for select to authenticated using ((bucket_id='blog-images' and (select public.is_admin()))) ;
commit;
