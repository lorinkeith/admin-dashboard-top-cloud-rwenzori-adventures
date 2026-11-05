-- Public marketing images only. Draft image URLs are not confidential once uploaded.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('tour-images','tour-images',true,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml']),
 ('hero-slides','hero-slides',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists topcloud_images_read on storage.objects;
create policy topcloud_images_read on storage.objects for select to anon, authenticated using (bucket_id in ('tour-images','hero-slides'));
drop policy if exists topcloud_images_insert on storage.objects;
create policy topcloud_images_insert on storage.objects for insert to authenticated with check (
 public.is_admin() and ((bucket_id='tour-images' and (name like 'packages/%' or name like 'customize/home/%'))
 or (bucket_id='hero-slides' and name ~ '^home/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'))
);
drop policy if exists topcloud_images_delete on storage.objects;
create policy topcloud_images_delete on storage.objects for delete to authenticated using (
 public.is_admin() and (bucket_id='tour-images' or (bucket_id='hero-slides'
 and not exists (select 1 from public.hero_slides h where position('/hero-slides/' || storage.objects.name in h.image_url)>0)))
);
commit;
