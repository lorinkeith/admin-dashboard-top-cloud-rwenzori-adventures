import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('blog SQL repeats safely; publication, admin authorization, comments and storage stay isolated', async () => {
  const db = new PGlite()
  const admin = '11111111-1111-4111-8111-111111111111'
  const outsider = '22222222-2222-4222-8222-222222222222'
  const post = '33333333-3333-4333-8333-333333333333'
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,storage to anon,authenticated;
      create table public.hero_slider_admins(user_id uuid primary key references auth.users);
      create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.hero_slider_admins where user_id=auth.uid()) $$;
      revoke all on function public.is_admin() from public,anon;
      grant execute on function public.is_admin() to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      insert into auth.users values ('${admin}'),('${outsider}');
      insert into public.hero_slider_admins values ('${admin}');
    `)
    const files = ['01_blog_schema.sql','02_blog_security.sql','03_blog_storage.sql']
    for (let pass = 0; pass < 2; pass++) for (const file of files) {
      await db.exec(await readFile(new URL(`../supabase/blog-setup/${file}`, import.meta.url), 'utf8'))
    }
    // Check service projections against the actual SQL catalog.
    for (const file of ['../src/lib/blogService.ts', '../../top-cloud-rwenzori-adventures/src/lib/supabaseBlog.ts']) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8')
      const fields = [...source.matchAll(/const (?:postListFields|postFullFields|fields) = '([^']+)'/g)].map(match => match[1])
      const columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='blog_posts'")).rows.map(row => row.column_name)
      for (const projection of fields) for (const field of projection.split(',blog_categories')[0].split(',')) assert.ok(columns.includes(field), `${file}: missing blog_posts.${field}`)
    }
    const asRole = async (role, uid = '') => db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role};`)
    const rows = async sql => (await db.query(sql)).rows
    await asRole('authenticated', admin)
    await db.exec(`insert into public.blog_categories(name,slug) values ('Safaris','safaris');
      insert into public.blog_posts(id,title,slug,status,content) values ('${post}','Safari','safari','draft','<h2>Uganda</h2>');
      insert into storage.objects(bucket_id,name) values ('blog-images','featured/draft/photo.webp');`)
    await asRole('anon')
    assert.equal((await rows('select * from public.blog_posts')).length, 0)
    await assert.rejects(db.exec(`insert into public.blog_posts(title,slug) values ('No','no')`))
    await assert.rejects(db.exec(`insert into public.blog_comments(post_id,name,email,comment) values ('${post}','Reader','private@example.invalid','Hi')`))
    await asRole('authenticated', outsider)
    assert.equal((await rows('select * from public.blog_posts')).length, 0)
    await assert.rejects(db.exec(`insert into public.blog_posts(title,slug) values ('No','no')`))
    await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values ('blog-images','unauthorized.jpg')`))
    await asRole('authenticated', admin)
    await db.exec(`update public.blog_posts set status='published',published_at=now() where id='${post}'`)
    await asRole('anon')
    assert.equal((await rows('select title from public.blog_posts')).length, 1)
    await db.exec(`insert into public.blog_comments(post_id,name,email,comment,status) values ('${post}','Reader','private@example.invalid','Great story','pending')`)
    await assert.rejects(db.query('select email from public.blog_comments'))
    await assert.rejects(db.query('select email from public.topcloud_public_blog_comments'))
    assert.equal((await rows('select * from public.topcloud_public_blog_comments')).length, 0)
    await asRole('authenticated', admin)
    await db.exec(`update public.blog_comments set status='approved'; update public.blog_posts set title='Updated safari' where id='${post}'`)
    await asRole('anon')
    assert.equal((await rows('select title from public.blog_posts'))[0].title, 'Updated safari')
    assert.equal((await rows('select * from public.topcloud_public_blog_comments')).length, 1)
    await asRole('authenticated', outsider)
    assert.equal((await rows('select * from public.blog_comments')).length, 0)
    await asRole('authenticated', admin)
    await db.exec(`update public.blog_posts set status='scheduled',scheduled_at=now()+interval '1 day' where id='${post}'`)
    await asRole('anon')
    assert.equal((await rows('select * from public.blog_posts')).length, 0)
    assert.equal((await rows('select * from public.topcloud_public_blog_comments')).length, 0)
    await asRole('authenticated', admin)
    await db.exec(`update public.blog_posts set scheduled_at=now()-interval '1 day' where id='${post}'`)
    await asRole('anon')
    assert.equal((await rows('select * from public.blog_posts')).length, 1)
    await asRole('authenticated', admin)
    await db.exec(`update public.blog_posts set status='draft' where id='${post}'`)
    await asRole('anon')
    assert.equal((await rows('select * from public.blog_posts')).length, 0)
    assert.equal((await rows('select * from public.topcloud_public_blog_comments')).length, 0)
    await asRole('authenticated', admin)
    await db.exec(`delete from public.blog_posts where id='${post}'`)
    assert.equal((await rows('select * from public.blog_comments')).length, 0)
  } finally { await db.close() }
})

test('blog schema refuses unrecognized existing tables without changing them', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create function public.is_admin() returns boolean language sql as $$ select false $$;
      create table public.blog_posts(legacy text); insert into public.blog_posts values ('preserve');`)
    await assert.rejects(db.exec(await readFile(new URL('../supabase/blog-setup/01_blog_schema.sql', import.meta.url), 'utf8')), /not owned by this setup/)
    await db.exec('rollback')
    assert.equal((await db.query('select legacy from public.blog_posts')).rows[0].legacy,'preserve')
  } finally { await db.close() }
})
