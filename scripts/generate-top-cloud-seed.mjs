import { readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'

// Export only the existing Top Cloud public tour catalogue, never reference-company data.
const source = await readFile(new URL('../../top-cloud-rwenzori-adventures/src/data/tours.ts', import.meta.url), 'utf8')
const images = { gorillaHero: '/brand/gorilla-hero.jpg', treeLions: '/brand/tree-lions.jpg', safariVehicle: '/brand/safari-vehicle.jpg', elephant: '/brand/elephant.jpg' }
const compiled = ts.transpileModule(source.replace("import { images } from './images'", `const images = ${JSON.stringify(images)}`), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { allTours } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const payload = JSON.stringify(allTours).replaceAll("'", "''")
const sql = `-- OPTIONAL: existing Top Cloud local catalogue only. Run after 01-05.
-- Inserts each missing slug and its children once; never changes an existing package.
-- Images use /brand paths available in BOTH applications. No customer or Auth data.
begin;
do $seed$
declare item jsonb; image jsonb; highlight jsonb; day jsonb; activity jsonb; package_uuid uuid; day_uuid uuid; position integer;
begin
 for item in select value from jsonb_array_elements('${payload}'::jsonb) loop
  package_uuid := null;
  insert into public.tour_packages(title,slug,category,duration_days,price_from_usd,price_mid_range_usd,short_description,overview,main_image_url,hero_image_url,status,display_order)
  values(item->>'title',item->>'slug',item->>'category',(item->>'durationDays')::integer,(item->>'priceFromUsd')::numeric,(item->>'priceFromUsd')::numeric,item->>'shortDescription',item->>'overview',item->>'mainImage',item->>'heroImage','published',1+(select count(*) from public.tour_packages))
  on conflict(slug) do nothing returning id into package_uuid;
  if package_uuid is null then continue; end if;
  position := 0;
  for image in select value from jsonb_array_elements(item->'galleryImages') loop
   insert into public.tour_gallery_images(package_id,image_url,sort_order) values(package_uuid,image#>>'{}',position);
   position := position + 1;
  end loop;
  position := 0;
  for highlight in select value from jsonb_array_elements(item->'highlights') loop
   insert into public.tour_highlights(package_id,title,sort_order) values(package_uuid,highlight#>>'{}',position);
   position := position + 1;
  end loop;
  for day in select value from jsonb_array_elements(item->'itineraryDays') loop
   insert into public.tour_itinerary_days(package_id,day_number,title,overview,accommodation_name,sort_order)
   values(package_uuid,(day->>'dayNumber')::integer,day->>'title',day->>'overview',day->>'accommodationName',(day->>'dayNumber')::integer)
   returning id into day_uuid;
   position := 0;
   for image in select value from jsonb_array_elements(day->'images') loop
    insert into public.tour_itinerary_images(itinerary_day_id,image_url,sort_order) values(day_uuid,image#>>'{}',position);
    position := position + 1;
   end loop;
   position := 0;
   for activity in select value from jsonb_array_elements(day->'activities') loop
    insert into public.tour_itinerary_activities(itinerary_day_id,title,description,sort_order) values(day_uuid,activity->>'title',activity->>'description',position);
    position := position + 1;
   end loop;
  end loop;
 end loop;
end $seed$;
commit;
`
await writeFile(new URL('../supabase/setup/06_optional_top_cloud_tours.sql', import.meta.url), sql)
console.log(`Prepared optional seed for ${allTours.length} existing Top Cloud tours.`)
