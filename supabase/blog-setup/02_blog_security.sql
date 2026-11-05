begin;
do $$ begin
  if to_regclass('public.topcloud_public_blog_comments') is not null and
     obj_description(to_regclass('public.topcloud_public_blog_comments'),'pg_class') is distinct from 'topcloud-blog-v1' then
    raise exception 'Existing topcloud_public_blog_comments is not owned by this setup. Review it before proceeding.';
  end if;
end $$;
alter table public.blog_categories enable row level security;
revoke all on public.blog_categories from anon, authenticated;
grant select, insert, update, delete on public.blog_categories to authenticated;
drop policy if exists topcloud_blog_admin on public.blog_categories;
create policy topcloud_blog_admin on public.blog_categories for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.blog_tags enable row level security;
revoke all on public.blog_tags from anon, authenticated;
grant select, insert, update, delete on public.blog_tags to authenticated;
drop policy if exists topcloud_blog_admin on public.blog_tags;
create policy topcloud_blog_admin on public.blog_tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from anon, authenticated;
grant select, insert, update, delete on public.blog_posts to authenticated;
drop policy if exists topcloud_blog_admin on public.blog_posts;
create policy topcloud_blog_admin on public.blog_posts for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.blog_post_tags enable row level security;
revoke all on public.blog_post_tags from anon, authenticated;
grant select, insert, update, delete on public.blog_post_tags to authenticated;
drop policy if exists topcloud_blog_admin on public.blog_post_tags;
create policy topcloud_blog_admin on public.blog_post_tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.blog_comments enable row level security;
revoke all on public.blog_comments from anon, authenticated;
grant select, insert, update, delete on public.blog_comments to authenticated;
drop policy if exists topcloud_blog_admin on public.blog_comments;
create policy topcloud_blog_admin on public.blog_comments for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.blog_posts to anon;
drop policy if exists topcloud_blog_public_read on public.blog_posts;
create policy topcloud_blog_public_read on public.blog_posts for select to anon, authenticated using ((status = 'published' or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now())));
grant select on public.blog_categories to anon;
drop policy if exists topcloud_blog_public_read on public.blog_categories;
create policy topcloud_blog_public_read on public.blog_categories for select to anon, authenticated using (true);
grant select on public.blog_tags to anon;
drop policy if exists topcloud_blog_public_read on public.blog_tags;
create policy topcloud_blog_public_read on public.blog_tags for select to anon, authenticated using (true);
grant select on public.blog_post_tags to anon;
drop policy if exists topcloud_blog_public_read on public.blog_post_tags;
create policy topcloud_blog_public_read on public.blog_post_tags for select to anon, authenticated using (exists (select 1 from public.blog_posts p where p.id = post_id and (status = 'published' or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()))));

-- Comment emails are available only to authorized administrators. The public view
-- exposes approved text only, and checks the parent post's current visibility.
create or replace view public.topcloud_public_blog_comments with (security_barrier = true) as
select c.id, c.post_id, c.name, c.comment, c.status, c.created_at
from public.blog_comments c join public.blog_posts p on p.id=c.post_id
where c.status='approved' and p.allow_comments and (p.status='published' or (p.status='scheduled' and p.scheduled_at <= now()));
comment on view public.topcloud_public_blog_comments is 'topcloud-blog-v1';
grant select on public.topcloud_public_blog_comments to anon, authenticated;
grant insert (post_id,name,email,comment,status) on public.blog_comments to anon;
drop policy if exists topcloud_blog_submit_comment on public.blog_comments;
create policy topcloud_blog_submit_comment on public.blog_comments for insert to anon with check (
  status='pending' and char_length(trim(name)) between 1 and 120
  and char_length(email) between 3 and 320 and char_length(trim(comment)) between 1 and 1200
  and exists(select 1 from public.blog_posts p where p.id=post_id and p.allow_comments and (status = 'published' or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now())))
);
commit;
