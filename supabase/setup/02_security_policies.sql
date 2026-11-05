-- Explicit grants plus RLS. Membership is assigned ONLY in SQL Editor.
begin;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.hero_slider_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
create or replace function public.is_hero_slider_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select public.is_admin(); $$;
revoke all on function public.is_hero_slider_admin() from public, anon;
grant execute on function public.is_hero_slider_admin() to authenticated;
grant usage on schema public to anon, authenticated;
alter table public.tour_packages enable row level security;
revoke all on public.tour_packages from anon, authenticated;
grant select, insert, update, delete on public.tour_packages to authenticated;
drop policy if exists admin_access on public.tour_packages;
create policy admin_access on public.tour_packages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_packages to anon;
drop policy if exists public_read on public.tour_packages;
create policy public_read on public.tour_packages for select to anon, authenticated using (status = 'published');
alter table public.tour_gallery_images enable row level security;
revoke all on public.tour_gallery_images from anon, authenticated;
grant select, insert, update, delete on public.tour_gallery_images to authenticated;
drop policy if exists admin_access on public.tour_gallery_images;
create policy admin_access on public.tour_gallery_images for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_gallery_images to anon;
drop policy if exists public_read on public.tour_gallery_images;
create policy public_read on public.tour_gallery_images for select to anon, authenticated using (exists (select 1 from public.tour_packages p where p.id = tour_gallery_images.package_id and p.status = 'published'));
alter table public.tour_highlights enable row level security;
revoke all on public.tour_highlights from anon, authenticated;
grant select, insert, update, delete on public.tour_highlights to authenticated;
drop policy if exists admin_access on public.tour_highlights;
create policy admin_access on public.tour_highlights for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_highlights to anon;
drop policy if exists public_read on public.tour_highlights;
create policy public_read on public.tour_highlights for select to anon, authenticated using (exists (select 1 from public.tour_packages p where p.id = tour_highlights.package_id and p.status = 'published'));
alter table public.tour_itinerary_days enable row level security;
revoke all on public.tour_itinerary_days from anon, authenticated;
grant select, insert, update, delete on public.tour_itinerary_days to authenticated;
drop policy if exists admin_access on public.tour_itinerary_days;
create policy admin_access on public.tour_itinerary_days for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_itinerary_days to anon;
drop policy if exists public_read on public.tour_itinerary_days;
create policy public_read on public.tour_itinerary_days for select to anon, authenticated using (exists (select 1 from public.tour_packages p where p.id = tour_itinerary_days.package_id and p.status = 'published'));
alter table public.tour_itinerary_activities enable row level security;
revoke all on public.tour_itinerary_activities from anon, authenticated;
grant select, insert, update, delete on public.tour_itinerary_activities to authenticated;
drop policy if exists admin_access on public.tour_itinerary_activities;
create policy admin_access on public.tour_itinerary_activities for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_itinerary_activities to anon;
drop policy if exists public_read on public.tour_itinerary_activities;
create policy public_read on public.tour_itinerary_activities for select to anon, authenticated using (exists (select 1 from public.tour_itinerary_days d join public.tour_packages p on p.id=d.package_id where d.id=tour_itinerary_activities.itinerary_day_id and p.status='published'));
alter table public.tour_itinerary_images enable row level security;
revoke all on public.tour_itinerary_images from anon, authenticated;
grant select, insert, update, delete on public.tour_itinerary_images to authenticated;
drop policy if exists admin_access on public.tour_itinerary_images;
create policy admin_access on public.tour_itinerary_images for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tour_itinerary_images to anon;
drop policy if exists public_read on public.tour_itinerary_images;
create policy public_read on public.tour_itinerary_images for select to anon, authenticated using (exists (select 1 from public.tour_itinerary_days d join public.tour_packages p on p.id=d.package_id where d.id=tour_itinerary_images.itinerary_day_id and p.status='published'));
alter table public.package_locations enable row level security;
revoke all on public.package_locations from anon, authenticated;
grant select, insert, update, delete on public.package_locations to authenticated;
drop policy if exists admin_access on public.package_locations;
create policy admin_access on public.package_locations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.package_locations to anon;
drop policy if exists public_read on public.package_locations;
create policy public_read on public.package_locations for select to anon, authenticated using (exists (select 1 from public.tour_packages p where p.id = package_locations.package_id and p.status = 'published'));
alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from anon, authenticated;
grant select, insert, update, delete on public.form_submissions to authenticated;
drop policy if exists admin_access on public.form_submissions;
create policy admin_access on public.form_submissions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.homepage_customizations enable row level security;
revoke all on public.homepage_customizations from anon, authenticated;
grant select, insert, update, delete on public.homepage_customizations to authenticated;
drop policy if exists admin_access on public.homepage_customizations;
create policy admin_access on public.homepage_customizations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.homepage_customization_elements enable row level security;
revoke all on public.homepage_customization_elements from anon, authenticated;
grant select, insert, update, delete on public.homepage_customization_elements to authenticated;
drop policy if exists admin_access on public.homepage_customization_elements;
create policy admin_access on public.homepage_customization_elements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.homepage_customization_elements to anon;
drop policy if exists public_read on public.homepage_customization_elements;
create policy public_read on public.homepage_customization_elements for select to anon, authenticated using (page_key = 'home' and is_published);
alter table public.hero_slider_admins enable row level security;
revoke all on public.hero_slider_admins from anon, authenticated;
grant select on public.hero_slider_admins to authenticated;
drop policy if exists admin_membership_self on public.hero_slider_admins;
create policy admin_membership_self on public.hero_slider_admins for select to authenticated using (user_id = (select auth.uid()));
alter table public.hero_slides enable row level security;
revoke all on public.hero_slides from anon, authenticated;
grant select on public.hero_slides to anon, authenticated;
drop policy if exists admin_access on public.hero_slides;
create policy admin_access on public.hero_slides for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.hero_slides to anon;
drop policy if exists public_read on public.hero_slides;
create policy public_read on public.hero_slides for select to anon, authenticated using (stage = 'published' and is_active);
alter table public.hero_settings enable row level security;
revoke all on public.hero_settings from anon, authenticated;
grant select on public.hero_settings to anon, authenticated;
drop policy if exists admin_access on public.hero_settings;
create policy admin_access on public.hero_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.hero_settings to anon;
drop policy if exists public_read on public.hero_settings;
create policy public_read on public.hero_settings for select to anon, authenticated using (stage = 'published');
alter table public.tour_analytics_events enable row level security;
revoke all on public.tour_analytics_events from anon, authenticated;
grant select, insert, update, delete on public.tour_analytics_events to authenticated;
drop policy if exists admin_access on public.tour_analytics_events;
create policy admin_access on public.tour_analytics_events for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.tripadvisor_reviews enable row level security;
revoke all on public.tripadvisor_reviews from anon, authenticated;
grant select, insert, update, delete on public.tripadvisor_reviews to authenticated;
drop policy if exists admin_access on public.tripadvisor_reviews;
create policy admin_access on public.tripadvisor_reviews for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.tripadvisor_reviews to anon;
drop policy if exists public_read on public.tripadvisor_reviews;
create policy public_read on public.tripadvisor_reviews for select to anon, authenticated using (true);

-- Anonymous requests can submit but can never list/read submissions or choose status/timestamps.
grant insert (type,package_id,tour_package_name,full_name,email,phone,country,preferred_travel_date,date_flexible,adults,children,children_ages,accommodation_preference,estimated_budget,budget_per_person,estimated_group_budget,currency,travelers,message,special_requests,raw_payload) on public.form_submissions to anon;
drop policy if exists public_submission on public.form_submissions;
create policy public_submission on public.form_submissions for insert to anon with check (
 type in ('booking','inquiry') and status='new' and length(trim(full_name)) between 1 and 200
 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(trim(phone)) between 1 and 80
 and (package_id is null or exists (select 1 from public.tour_packages p where p.id=package_id and p.status='published'))
);
-- Expose only the published homepage JSON. The table itself stays admin-only, including draft_content.
create or replace function public.get_published_homepage() returns jsonb
language sql stable security definer set search_path = '' as $$
 select published_content from public.homepage_customizations where page_key='home' and published_at is not null;
$$;
revoke all on function public.get_published_homepage() from public;
grant execute on function public.get_published_homepage() to anon, authenticated;
commit;
