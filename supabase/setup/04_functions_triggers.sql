begin;
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists topcloud_updated_at on public.tour_packages;
create trigger topcloud_updated_at before update on public.tour_packages for each row execute function public.set_updated_at();
drop trigger if exists topcloud_updated_at on public.tour_itinerary_days;
create trigger topcloud_updated_at before update on public.tour_itinerary_days for each row execute function public.set_updated_at();
drop trigger if exists topcloud_updated_at on public.package_locations;
create trigger topcloud_updated_at before update on public.package_locations for each row execute function public.set_updated_at();
drop trigger if exists topcloud_updated_at on public.form_submissions;
create trigger topcloud_updated_at before update on public.form_submissions for each row execute function public.set_updated_at();
drop trigger if exists topcloud_updated_at on public.homepage_customizations;
create trigger topcloud_updated_at before update on public.homepage_customizations for each row execute function public.set_updated_at();
drop trigger if exists topcloud_updated_at on public.homepage_customization_elements;
create trigger topcloud_updated_at before update on public.homepage_customization_elements for each row execute function public.set_updated_at();

create or replace function public.replace_hero_snapshot(p_slider jsonb, p_stage text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_stage not in ('draft','published') or jsonb_typeof(p_slider) is distinct from 'object'
    or jsonb_typeof(p_slider->'slides') is distinct from 'array'
    or jsonb_array_length(p_slider->'slides') > 50
    or jsonb_typeof(p_slider->'autoplay') is distinct from 'boolean'
    or (p_slider->>'duration_seconds')::integer not in (3,5,7,10) then
    raise exception 'Invalid hero configuration';
  end if;
  -- Reject rather than silently coerce malformed active flags.
  if exists (select 1 from jsonb_array_elements(p_slider->'slides') s where jsonb_typeof(s->'is_active') is distinct from 'boolean') then
    raise exception 'Invalid hero status';
  end if;
  -- Preserve created_at across edits and reorders; delete only removed records.
  delete from public.hero_slides h where h.stage = p_stage and not exists
    (select 1 from jsonb_array_elements(p_slider->'slides') s where (s->>'id')::uuid = h.id);
  -- Avoid transient collisions while swapping sort positions in this transaction.
  update public.hero_slides set sort_order = sort_order + 100000 where stage = p_stage;
  insert into public.hero_slides (id,stage,image_url,pre_title,title,subtitle,button_text,button_url,text_position,sort_order,is_active)
  select (s->>'id')::uuid, p_stage, s->>'image_url', coalesce(s->>'pre_title',''), s->>'title',
    coalesce(s->>'subtitle',''), coalesce(s->>'button_text',''), coalesce(s->>'button_url',''),
    coalesce(s->>'text_position','bottom-right'), (n-1)::integer, (s->>'is_active')::boolean
  from jsonb_array_elements(p_slider->'slides') with ordinality as rows(s,n)
  on conflict (id,stage) do update set image_url=excluded.image_url,pre_title=excluded.pre_title,title=excluded.title,
    subtitle=excluded.subtitle,button_text=excluded.button_text,button_url=excluded.button_url,
    text_position=excluded.text_position,sort_order=excluded.sort_order,is_active=excluded.is_active,updated_at=now();
  insert into public.hero_settings(stage,autoplay,duration_seconds) values
    (p_stage,(p_slider->>'autoplay')::boolean,(p_slider->>'duration_seconds')::integer)
  on conflict (stage) do update set autoplay=excluded.autoplay,duration_seconds=excluded.duration_seconds,updated_at=now();
end;
$$;
revoke all on function public.replace_hero_snapshot(jsonb,text) from public, anon, authenticated;

create or replace function public.save_homepage_with_hero(p_content jsonb, p_publish boolean default false)
returns public.homepage_customizations
language plpgsql security definer set search_path = '' as $$
declare result public.homepage_customizations;
begin
  if not public.is_hero_slider_admin() then raise exception 'Administrator membership required' using errcode='42501'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or not (p_content ? 'heroSlider') then raise exception 'Hero configuration required'; end if;
  perform pg_advisory_xact_lock(748526190);
  perform public.replace_hero_snapshot(p_content->'heroSlider','draft');
  if p_publish then perform public.replace_hero_snapshot(p_content->'heroSlider','published'); end if;
  -- Keep draft/inactive hero data OUT of publicly-readable homepage JSON.
  insert into public.homepage_customizations (page_key,draft_content,published_content,published_at)
  values ('home',p_content-'heroSlider',case when p_publish then p_content-'heroSlider' else '{}'::jsonb end,
    case when p_publish then now() else null end)
  on conflict (page_key) do update set draft_content=excluded.draft_content,
    published_content=case when p_publish then excluded.published_content else homepage_customizations.published_content end,
    published_at=case when p_publish then now() else homepage_customizations.published_at end
  returning * into result;
  return result;
end;
$$;
revoke all on function public.save_homepage_with_hero(jsonb,boolean) from public, anon;
grant execute on function public.save_homepage_with_hero(jsonb,boolean) to authenticated;

create or replace function public.get_published_hero_slider() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('autoplay',s.autoplay,'duration_seconds',s.duration_seconds,'slides',
    coalesce((select jsonb_agg(to_jsonb(h)-'stage' order by h.sort_order) from public.hero_slides h
      where h.stage='published' and h.is_active),'[]'::jsonb))
  from public.hero_settings s where s.stage='published';
$$;
revoke all on function public.get_published_hero_slider() from public;
grant execute on function public.get_published_hero_slider() to anon, authenticated;

create or replace function public.get_hero_slider_editor_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_hero_slider_admin() then raise exception 'Administrator membership required' using errcode='42501'; end if;
  select jsonb_object_agg(s.stage, jsonb_build_object('autoplay',s.autoplay,'duration_seconds',s.duration_seconds,'slides',
    coalesce((select jsonb_agg(to_jsonb(h)-'stage' order by h.sort_order) from public.hero_slides h where h.stage=s.stage),'[]'::jsonb)))
  into result from public.hero_settings s;
  return coalesce(result,'{}'::jsonb);
end;
$$;
revoke all on function public.get_hero_slider_editor_state() from public, anon;
grant execute on function public.get_hero_slider_editor_state() to authenticated;


create or replace function public.record_tour_analytics_event(
  p_tour_id uuid,
  p_event_type text,
  p_visitor_id uuid,
  p_session_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('view', 'book_now', 'inquiry', 'booking_submitted') then
    raise exception 'Unsupported analytics event type: %', p_event_type;
  end if;

  if not exists (
    select 1
    from public.tour_packages
    where id = p_tour_id
      and status = 'published'
  ) then
    raise exception 'Tour package was not found or is not published.';
  end if;

  insert into public.tour_analytics_events (
    tour_id,
    event_type,
    visitor_id,
    session_id
  )
  values (
    p_tour_id,
    p_event_type,
    p_visitor_id,
    p_session_id
  );
end;
$$;

create or replace function public.get_tour_analytics_overview(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  total_views bigint,
  unique_visitors bigint,
  book_now_clicks bigint,
  inquiries bigint,
  bookings bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where event_type = 'view') as total_views,
    count(distinct visitor_id) filter (where event_type = 'view') as unique_visitors,
    count(*) filter (where event_type = 'book_now') as book_now_clicks,
    count(*) filter (where event_type = 'inquiry') as inquiries,
    count(*) filter (where event_type = 'booking_submitted') as bookings
  from public.tour_analytics_events
  where (p_start_at is null or created_at >= p_start_at)
    and (p_end_at is null or created_at < p_end_at);
$$;

create or replace function public.get_tour_package_analytics(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  tour_id uuid,
  package_title text,
  package_slug text,
  views bigint,
  unique_visitors bigint,
  book_now_clicks bigint,
  inquiries bigint,
  bookings bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    packages.id as tour_id,
    packages.title as package_title,
    packages.slug as package_slug,
    count(events.id) filter (where events.event_type = 'view') as views,
    count(distinct events.visitor_id) filter (where events.event_type = 'view') as unique_visitors,
    count(events.id) filter (where events.event_type = 'book_now') as book_now_clicks,
    count(events.id) filter (where events.event_type = 'inquiry') as inquiries,
    count(events.id) filter (where events.event_type = 'booking_submitted') as bookings
  from public.tour_packages packages
  left join public.tour_analytics_events events
    on events.tour_id = packages.id
    and (p_start_at is null or events.created_at >= p_start_at)
    and (p_end_at is null or events.created_at < p_end_at)
  group by packages.id, packages.title, packages.slug
  order by
    count(events.id) filter (where events.event_type = 'booking_submitted') desc,
    count(events.id) filter (where events.event_type = 'inquiry') desc,
    count(events.id) filter (where events.event_type = 'book_now') desc,
    count(events.id) filter (where events.event_type = 'view') desc,
    packages.title asc;
$$;

create or replace function public.get_tour_views_over_time(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  view_date date,
  views bigint,
  unique_visitors bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('day', created_at)::date as view_date,
    count(*) filter (where event_type = 'view') as views,
    count(distinct visitor_id) filter (where event_type = 'view') as unique_visitors
  from public.tour_analytics_events
  where (p_start_at is null or created_at >= p_start_at)
    and (p_end_at is null or created_at < p_end_at)
  group by date_trunc('day', created_at)::date
  order by view_date asc;
$$;

revoke all on function public.record_tour_analytics_event(uuid, text, uuid, uuid) from public;
revoke all on function public.get_tour_analytics_overview(timestamptz, timestamptz) from public;
revoke all on function public.get_tour_package_analytics(timestamptz, timestamptz) from public;
revoke all on function public.get_tour_views_over_time(timestamptz, timestamptz) from public;

grant execute on function public.record_tour_analytics_event(uuid, text, uuid, uuid) to anon, authenticated;
grant execute on function public.get_tour_analytics_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_tour_package_analytics(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_tour_views_over_time(timestamptz, timestamptz) to authenticated;


do $$ declare t text; begin
 if exists (select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['tour_packages','homepage_customization_elements','hero_settings','hero_slides','form_submissions'] loop
   if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
notify pgrst, 'reload schema';

commit;
