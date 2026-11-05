-- Derived from the reference schema, hero-slides, tour-analytics and tripadvisor migrations.
-- Fresh Top Cloud project ONLY. No customer/authentication records are copied.
begin;
create table if not exists public.tour_packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null,
  duration_days integer not null check (duration_days > 0),
  price_from_usd numeric(10, 2) check (price_from_usd is null or price_from_usd >= 0),
  price_budget_usd numeric(10, 2) check (price_budget_usd is null or price_budget_usd >= 0),
  price_mid_range_usd numeric(10, 2) check (price_mid_range_usd is null or price_mid_range_usd >= 0),
  price_luxury_usd numeric(10, 2) check (price_luxury_usd is null or price_luxury_usd >= 0),
  accommodation_tier text not null default 'standard' check (accommodation_tier in ('standard', 'budget', 'mid_range', 'luxury')),
  short_description text not null,
  overview text not null,
  main_image_url text,
  hero_image_url text,
  map_style text not null default 'light' check (map_style in ('light', 'green', 'warm', 'dark')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_gallery_images (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  image_url text not null,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_highlights (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null,
  overview text not null,
  accommodation_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, day_number)
);

create table if not exists public.tour_itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  itinerary_day_id uuid not null references public.tour_itinerary_days(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_itinerary_images (
  id uuid primary key default gen_random_uuid(),
  itinerary_day_id uuid not null references public.tour_itinerary_days(id) on delete cascade,
  image_url text not null,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.package_locations (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  location_name text not null,
  latitude double precision not null check (latitude between -1.6 and 4.4),
  longitude double precision not null check (longitude between 29.3 and 35.2),
  notes text,
  image_url text,
  pin_color text not null default '#FB770D' check (pin_color ~ '^#[0-9A-Fa-f]{6}$'),
  day_order integer not null check (day_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, location_name),
  unique (package_id, day_order)
);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('booking', 'inquiry')),
  status text not null default 'new' check (status in ('new', 'processed')),
  package_id uuid references public.tour_packages(id) on delete set null,
  tour_package_name text,
  full_name text not null,
  email text not null,
  phone text not null,
  country text,
  preferred_travel_date date,
  date_flexible boolean,
  adults integer check (adults is null or adults >= 0),
  children integer check (children is null or children >= 0),
  children_ages text,
  accommodation_preference text,
  estimated_budget text,
  budget_per_person text,
  estimated_group_budget text,
  currency text,
  travelers integer check (travelers is null or travelers >= 0),
  message text,
  special_requests text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_customizations (
  id uuid primary key default gen_random_uuid(),
  page_key text not null default 'home' unique,
  draft_content jsonb not null default '{}'::jsonb,
  published_content jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_customization_elements (
  id uuid primary key default gen_random_uuid(),
  page_key text not null default 'home',
  section_name text not null,
  element_key text not null,
  element_type text not null,
  content_value jsonb not null default 'null'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_customization_elements_type_check
    check (element_type in ('text', 'image', 'icon', 'button', 'link', 'section', 'json')),
  constraint homepage_customization_elements_unique
    unique (page_key, section_name, element_key, is_published)
);

create table if not exists public.hero_slider_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.hero_slides (
  id uuid not null default gen_random_uuid(),
  stage text not null check (stage in ('draft', 'published')),
  image_url text not null check (length(trim(image_url)) > 0),
  pre_title text not null default '' check (length(pre_title) <= 100),
  title text not null check (length(trim(title)) > 0 and length(title) <= 180),
  subtitle text not null default '' check (length(subtitle) <= 400),
  button_text text not null default '' check (length(button_text) <= 60),
  button_url text not null default '' check (length(button_url) <= 2048),
  text_position text not null default 'bottom-right' check (text_position in
    ('top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, stage),
  unique (stage, sort_order),
  check ((button_text = '' and button_url = '') or (length(trim(button_text)) > 0 and length(trim(button_url)) > 0)),
  check (image_url ~* '^(https?://|/[^/])' and image_url !~ E'[\\\\\n\r]'),
  check (button_url = '' or (button_url ~* '^(https?://|mailto:|tel:|/[^/]|/$|#)' and button_url !~ E'[\\\\\n\r]'))
);

create table if not exists public.hero_settings (
  stage text primary key check (stage in ('draft', 'published')),
  autoplay boolean not null default true,
  duration_seconds integer not null default 5 check (duration_seconds in (3,5,7,10)),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_analytics_events (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour_packages(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'book_now', 'inquiry', 'booking_submitted')),
  visitor_id uuid not null,
  session_id uuid,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.tripadvisor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id text UNIQUE NOT NULL,
  author_name text,
  author_image text,
  rating int,
  review_text text,
  review_date timestamp,
  created_at timestamp DEFAULT now()
);

create index if not exists tour_packages_slug_idx on public.tour_packages(slug);

create index if not exists tour_packages_display_order_idx on public.tour_packages(display_order, created_at desc);

create index if not exists tour_gallery_images_package_id_idx on public.tour_gallery_images(package_id);

create index if not exists tour_highlights_package_id_idx on public.tour_highlights(package_id);

create index if not exists tour_itinerary_days_package_id_idx on public.tour_itinerary_days(package_id);

create index if not exists tour_itinerary_activities_day_id_idx on public.tour_itinerary_activities(itinerary_day_id);

create index if not exists tour_itinerary_images_day_id_idx on public.tour_itinerary_images(itinerary_day_id);

create index if not exists package_locations_package_id_idx on public.package_locations(package_id);

create index if not exists package_locations_day_order_idx on public.package_locations(package_id, day_order);

create unique index if not exists package_locations_unique_name_idx on public.package_locations(package_id, lower(location_name));

create index if not exists form_submissions_created_at_idx on public.form_submissions(created_at desc);

create index if not exists form_submissions_type_idx on public.form_submissions(type);

create index if not exists form_submissions_status_idx on public.form_submissions(status);

create index if not exists form_submissions_package_id_idx on public.form_submissions(package_id);

create index if not exists homepage_customization_elements_lookup_idx on public.homepage_customization_elements(page_key, is_published, section_name);

create index if not exists hero_slides_public_order on public.hero_slides (stage, sort_order) where is_active;

create index if not exists tour_analytics_events_tour_id_idx
on public.tour_analytics_events(tour_id);

create index if not exists tour_analytics_events_event_type_idx
on public.tour_analytics_events(event_type);

create index if not exists tour_analytics_events_visitor_id_idx
on public.tour_analytics_events(visitor_id);

create index if not exists tour_analytics_events_created_at_idx
on public.tour_analytics_events(created_at desc);

create index if not exists tour_analytics_events_tour_created_idx
on public.tour_analytics_events(tour_id, created_at desc);

CREATE INDEX IF NOT EXISTS tripadvisor_reviews_review_date_idx
  ON public.tripadvisor_reviews (review_date DESC);
commit;
