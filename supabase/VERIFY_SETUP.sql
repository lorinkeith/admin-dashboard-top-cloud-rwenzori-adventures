-- Read-only checks. Run after RUN_THIS_SETUP.sql and administrator enrollment.
-- Every row should be true. Also run the anonymous API and browser checks.
with expected(name) as (
  values ('tour_packages'), ('tour_gallery_images'), ('tour_highlights'),
    ('tour_itinerary_days'), ('tour_itinerary_activities'), ('tour_itinerary_images'),
    ('package_locations'), ('form_submissions'), ('homepage_customizations'),
    ('homepage_customization_elements'), ('hero_slider_admins'), ('hero_slides'),
    ('hero_settings'), ('tour_analytics_events'), ('tripadvisor_reviews')
)
select 'table + RLS: ' || e.name as check_name,
  coalesce(t.rowsecurity, false) as passed
from expected e left join pg_tables t on t.schemaname = 'public' and t.tablename = e.name
union all
select 'at least one administrator enrolled', exists(select 1 from public.hero_slider_admins)
union all
select 'homepage singleton exists', exists(select 1 from public.homepage_customizations where page_key = 'home')
union all
select 'bucket configured: ' || id,
  public and file_size_limit = 5242880
  and allowed_mime_types @> array['image/jpeg','image/png','image/webp']
from storage.buckets where id in ('tour-images', 'hero-slides')
union all
select 'both image buckets exist', count(*) = 2
from storage.buckets where id in ('tour-images', 'hero-slides')
union all
select 'anonymous submission INSERT granted',
  has_column_privilege('anon', 'public.form_submissions', 'full_name', 'INSERT')
union all
select 'anonymous submission SELECT blocked',
  not has_table_privilege('anon', 'public.form_submissions', 'SELECT')
union all
select 'function exists: ' || signature, to_regprocedure(signature) is not null
from unnest(array[
  'public.is_admin()', 'public.is_hero_slider_admin()',
  'public.get_published_homepage()', 'public.get_published_hero_slider()',
  'public.get_hero_slider_editor_state()', 'public.save_homepage_with_hero(jsonb,boolean)',
  'public.record_tour_analytics_event(uuid,text,uuid,uuid)',
  'public.get_tour_analytics_overview(timestamp with time zone,timestamp with time zone)',
  'public.get_tour_package_analytics(timestamp with time zone,timestamp with time zone)',
  'public.get_tour_views_over_time(timestamp with time zone,timestamp with time zone)'
]) as functions(signature)
union all
select 'Realtime enabled: ' || name, exists (
  select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = name
)
from unnest(array['tour_packages','homepage_customization_elements','hero_settings','hero_slides','form_submissions']) as realtime(name)
order by check_name;
