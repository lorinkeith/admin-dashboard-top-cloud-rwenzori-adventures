-- Additive blog installation. Run in order after the existing Top Cloud setup.
begin;
do $$ declare object_name text; begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Run the existing Top Cloud Supabase setup first: public.is_admin() is required.';
  end if;
  if to_regprocedure('public.topcloud_blog_updated_at()') is not null and
     obj_description(to_regprocedure('public.topcloud_blog_updated_at()'),'pg_proc') is distinct from 'topcloud-blog-v1' then
    raise exception 'Existing topcloud_blog_updated_at function is not owned by this setup. Review it before proceeding.';
  end if;
  foreach object_name in array ARRAY['blog_categories','blog_tags','blog_posts','blog_post_tags','blog_comments'] loop
    if to_regclass('public.' || object_name) is not null and
       obj_description(to_regclass('public.' || object_name),'pg_class') is distinct from 'topcloud-blog-v1' then
      raise exception 'Existing object public.% is not owned by this setup. Review its columns, constraints and policies before adapting this migration.', object_name;
    end if;
  end loop;
end $$;
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  featured_image_url text,
  featured_image_path text,
  featured_image_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  status text not null default 'draft',
  seo_title text,
  meta_description text,
  focus_keyword text,
  seo_keywords text[],
  canonical_url text,
  is_featured boolean not null default false,
  allow_comments boolean not null default true,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check check (status in ('draft', 'published', 'scheduled', 'archived'))
);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  name text not null,
  email text not null,
  comment text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint blog_comments_status_check check (status in ('pending', 'approved', 'rejected', 'spam'))
);

comment on table public.blog_categories is 'topcloud-blog-v1';
comment on table public.blog_tags is 'topcloud-blog-v1';
comment on table public.blog_posts is 'topcloud-blog-v1';
comment on table public.blog_post_tags is 'topcloud-blog-v1';
comment on table public.blog_comments is 'topcloud-blog-v1';

create index if not exists topcloud_blog_publication_idx on public.blog_posts(status, published_at desc, scheduled_at);
create index if not exists topcloud_blog_category_idx on public.blog_posts(category_id);
create index if not exists topcloud_blog_comment_post_idx on public.blog_comments(post_id,status);
create or replace function public.topcloud_blog_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
comment on function public.topcloud_blog_updated_at() is 'topcloud-blog-v1';
drop trigger if exists topcloud_blog_updated_at on public.blog_posts;
create trigger topcloud_blog_updated_at before update on public.blog_posts for each row execute function public.topcloud_blog_updated_at();
drop trigger if exists topcloud_blog_updated_at on public.blog_categories;
create trigger topcloud_blog_updated_at before update on public.blog_categories for each row execute function public.topcloud_blog_updated_at();
commit;
