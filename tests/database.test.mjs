import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Real PostgreSQL execution with minimal stand-ins for Supabase-managed schemas.
// This never connects to a remote project and does not emulate Auth/Storage APIs.
for (const installation of ['numbered files', 'combined bundle']) test(`${installation}: setup is repeatable; published content, admin writes and private submissions are isolated`, async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,storage to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
    `)
    const setup = new URL('../supabase/setup/', import.meta.url)
    const files = (await readdir(setup)).filter(name => name.endsWith('.sql') && !name.startsWith('06_')).sort()
    for (let pass = 0; pass < 2; pass++) {
      if (installation === 'combined bundle') await db.exec(await readFile(new URL('../supabase/RUN_THIS_SETUP.sql', import.meta.url), 'utf8'))
      else for (const name of files) await db.exec(await readFile(new URL(name, setup), 'utf8'))
    }
    const catalog = (await db.query("select tablename,rowsecurity from pg_tables where schemaname='public'")).rows
    assert.equal(catalog.length, 15)
    assert.ok(catalog.every(table => table.rowsecurity))
    // Check the literal table/column projections in both application's services
    // against PostgreSQL's actual generated catalog, rather than frontend types.
    for (const directory of [new URL('../src/services/', import.meta.url), new URL('../../top-cloud-rwenzori-adventures/src/services/', import.meta.url)]) {
      for (const file of (await readdir(directory)).filter(file => file.endsWith('.ts'))) {
        const source = await readFile(new URL(file, directory), 'utf8')
        for (const match of source.matchAll(/\.from\('([a-z_]+)'\)\s*\.select\(\s*'([^']+)'/g)) {
          const [, table, projection] = match
          const columns = (await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2', ['public', table])).rows.map(row => row.column_name)
          assert.ok(columns.length, `${file}: missing table ${table}`)
          if (!projection.includes('*') && !projection.includes('(')) for (const column of projection.split(',')) assert.ok(columns.includes(column.trim()), `${file}: missing ${table}.${column}`)
        }
      }
    }
    const admin = '11111111-1111-4111-8111-111111111111'
    const outsider = '22222222-2222-4222-8222-222222222222'
    const published = '33333333-3333-4333-8333-333333333333'
    const draft = '44444444-4444-4444-8444-444444444444'
    await db.exec(`insert into auth.users values ('${admin}'),('${outsider}'); insert into public.hero_slider_admins(user_id) values ('${admin}');`)
    const checks = (await db.query(await readFile(new URL('../supabase/VERIFY_SETUP.sql', import.meta.url), 'utf8'))).rows
    // This fixture has no logical replication publication; verify those separately on Supabase.
    assert.equal(checks.filter(check => check.check_name.startsWith('Realtime enabled:')).length, 5)
    for (const check of checks.filter(check => !check.check_name.startsWith('Realtime enabled:'))) {
      assert.equal(check.passed, true, check.check_name)
    }
    const asRole = async (role, uid = '') => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role};`) }
    const rows = async sql => (await db.query(sql)).rows
    const denied = async sql => assert.rejects(db.exec(sql))
    await asRole('authenticated', admin)
    for (const [id, status] of [[published, 'published'], [draft, 'draft']]) {
      await db.query(`insert into public.tour_packages(id,title,slug,category,duration_days,short_description,overview,status) values ($1,$2,$2,'Wildlife',3,'Safari','Guided safari',$3)`, [id, status, status])
      await db.query(`insert into public.tour_gallery_images(package_id,image_url) values ($1,'https://example.invalid/lions.jpg')`, [id])
    }
    assert.equal((await rows('select public.is_admin() allowed'))[0].allowed, true)
    await asRole('anon')
    assert.equal((await rows('select * from public.tour_packages')).length, 1)
    assert.equal((await rows('select * from public.tour_gallery_images')).length, 1)
    await denied(`insert into public.tour_packages(title) values ('forbidden')`)
    await db.exec(`insert into public.form_submissions(type,full_name,email,phone,message) values ('inquiry','Test visitor','visitor@example.invalid','+256747558826','Test inquiry')`)
    await denied('select * from public.form_submissions')
    await denied(`insert into public.form_submissions(type,full_name,email,phone,status) values ('inquiry','Test','test@example.invalid','123','processed')`)
    await asRole('authenticated', outsider)
    assert.equal((await rows('select public.is_admin() allowed'))[0].allowed, false)
    assert.equal((await rows('select * from public.form_submissions')).length, 0)
    assert.equal((await rows('select * from public.homepage_customizations')).length, 0)
    await denied(`insert into public.hero_slider_admins(user_id) values ('${outsider}')`)
    await denied(`insert into public.tour_packages(title,slug,category,duration_days,short_description,overview) values ('Forbidden','forbidden','Wildlife',1,'x','x')`)
    await denied(`select public.save_homepage_with_hero('{}',true)`)
    await denied(`insert into storage.objects(bucket_id,name) values ('tour-images','packages/forbidden/image.png')`)
    await asRole('authenticated', admin)
    assert.equal((await rows('select * from public.form_submissions')).length, 1)
    await db.exec(`update public.form_submissions set status='processed';`)
    const slide = { id: '55555555-5555-4555-8555-555555555555', image_url: 'https://example.invalid/storage/v1/object/public/hero-slides/home/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', title: 'Published safari', subtitle: '', pre_title: '', button_text: '', button_url: '', text_position: 'center-left', sort_order: 0, is_active: true }
    const home = { heroSlider: { autoplay: true, duration_seconds: 5, slides: [slide] }, story: { title: 'Published story' } }
    await db.query('select public.save_homepage_with_hero($1,true)', [home])
    home.story.title = 'PRIVATE DRAFT'
    home.heroSlider.slides[0].title = 'PRIVATE SLIDE'
    await db.query('select public.save_homepage_with_hero($1,false)', [home])
    await asRole('anon')
    const visible = JSON.stringify(await rows('select public.get_published_homepage() home,public.get_published_hero_slider() hero'))
    assert.ok(visible.includes('Published story'))
    assert.ok(visible.includes('Published safari'))
    assert.ok(!visible.includes('PRIVATE'))
    await denied(`select public.get_hero_slider_editor_state()`)
    await db.query(`select public.record_tour_analytics_event($1,'view',$2,null)`, [published, outsider])
    await assert.rejects(db.query(`select public.record_tour_analytics_event($1,'view',$2,null)`, [draft, outsider]))
    await denied('select * from public.tour_analytics_events')
    await asRole('authenticated', admin)
    assert.equal(Number((await rows('select * from public.get_tour_analytics_overview()'))[0].total_views), 1)
    await db.exec(`insert into storage.objects(bucket_id,name) values ('tour-images','packages/test/main/image.png')`)
    await asRole('anon')
    await denied(`insert into storage.objects(bucket_id,name) values ('tour-images','packages/test/main/forbidden.png')`)
    await asRole('authenticated', admin)
    await db.exec(`update public.tour_packages set status='archived' where id='${published}'`)
    await asRole('anon')
    assert.equal((await rows('select * from public.tour_packages')).length, 0)
    assert.equal((await rows('select * from public.tour_gallery_images')).length, 0)
    await asRole('authenticated', admin)
    const day = (await db.query(`insert into public.tour_itinerary_days(package_id,day_number,title,overview) values ($1,1,'Arrival','Start your safari') returning id`, [draft])).rows[0].id
    await db.query(`insert into public.tour_itinerary_activities(itinerary_day_id,title) values ($1,'Guided walk')`, [day])
    await db.query(`insert into public.tour_itinerary_images(itinerary_day_id,image_url) values ($1,'https://example.invalid/gorilla.jpg')`, [day])
    await db.query(`insert into public.package_locations(package_id,location_name,latitude,longitude,day_order) values ($1,'Kampala',0.3476,32.5825,1)`, [draft])
    await db.exec(`insert into public.tripadvisor_reviews(review_id,author_name,rating,review_text) values ('test-review','Test visitor',5,'Our test safari')`)
    await db.exec(`delete from public.tour_packages where id='${draft}'`)
    assert.equal((await rows('select * from public.tour_itinerary_activities')).length, 0)
    assert.equal((await rows('select * from public.tour_itinerary_images')).length, 0)
    assert.equal((await rows('select * from public.package_locations')).length, 0)
    await db.exec('reset role')
    for (const name of files) await db.exec(await readFile(new URL(name, setup), 'utf8'))
    assert.equal((await rows(`select status from public.tour_packages where id='${published}'`))[0].status, 'archived')
    assert.equal((await rows('select * from public.form_submissions')).length, 1)
    assert.ok(JSON.stringify(await rows('select draft_content from public.homepage_customizations')).includes('PRIVATE DRAFT'))
    const seed = await readFile(new URL('06_optional_top_cloud_tours.sql', setup), 'utf8')
    await db.exec(seed)
    const seededCount = (await rows('select * from public.tour_packages')).length
    assert.equal(seededCount, 10)
    await db.exec(seed)
    assert.equal((await rows('select * from public.tour_packages')).length, seededCount)
    assert.equal((await rows(`select status from public.tour_packages where id='${published}'`))[0].status, 'archived')
  } finally { await db.close() }
})
