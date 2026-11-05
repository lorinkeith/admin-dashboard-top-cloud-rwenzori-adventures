# Top Cloud Rwenzori Adventures integration report

**Update, 2 November 2026:** Both local apps now use the same configured Supabase project and publishable key for frontend and server endpoints. Read-only live probes reached that project, but all 15 application tables returned `PGRST205` and both published-content RPCs returned `PGRST202`. Run `supabase/RUN_THIS_SETUP.sql`, enroll your Auth administrator with `supabase/ADD_ADMIN.sql`, and follow `SUPABASE_SETUP_GUIDE.md`. The report below records the earlier 29 October implementation; its statements about connection/testing status are historical.

Prepared on 29 October 2026. Local implementation is complete for credential configuration and live verification. **No new Supabase project has been connected, no production database was tested, and no Cloudflare deployment was performed.**

## Analysis and reference preservation

All four project roots were inspected, including hidden configuration filenames, package manifests, routing, components, service calls, SQL migrations, Storage usage and hosting files. Source inventory is recorded in `verification/source-inventory.json`, without environment values. Initial SHA-256 fingerprints of the two reference directories are in `verification/reference-hashes.json`; generated directories and Git metadata are excluded.

The original public site uses React 19, React Router 7, TypeScript, Vite 8, Tailwind 4, Supabase JS, Leaflet, i18next and locale helpers. Its tour services select published packages and their gallery/highlight/itinerary/location children. Homepage JSON and hero RPCs provide published content. Review reads and analytics events use separate services. Booking/inquiry endpoints write `form_submissions`; original deployments include Cloudflare Pages Functions plus alternate Node/Netlify/email adapters. The original source supports legacy anon-key conventions and some privileged server-key fallbacks; those fallbacks were not copied into the new system.

The reference admin uses React 19, React Router 7, TypeScript, Vite 8, Tailwind 3, Supabase JS, Leaflet/React Leaflet, React Icons, Lucide and class utilities. It authenticates with email/password. Its layout and navigation expose six implemented modules. There is no standalone user-management, payment, reservation inventory or settings module; unused labels were not treated as implemented features.

The Top Cloud public site initially used local typed tour arrays, a different existing visual design and Resend contact endpoints, without a Supabase client. Its home, tour list/detail, about and contact routes were retained. CSS classes, responsive containers, navigation structure, reveals, carousels and branding were preserved while data bindings were added. A route map replaces the generic map only when a package has managed route locations. Reviews render in the existing visual style only when actual imported reviews exist. No original-company testimonials were seeded.

**Reference integrity result:** all 288 fingerprinted reference file contents match the initial snapshot. One filename difference was detected in the original public assets: `src/assets/james-top-cloud-rwenzori-adventures-safari.jpg` is now `src/assets/james-uganda-family-tours-safari.jpg`, with identical bytes. No task command renamed that original asset. It was left untouched because the originals must not be edited. `npm run verify:references` reports this path difference with a nonzero status rather than masking it. All original source/configuration contents and the original admin's file paths match. The verifier requires the original folders to remain beside this dashboard.

## What was copied and changed

The complete dashboard application was copied into `top-cloud-rwenzori-adventures-admin-dashboard`: pages, package editors, sidebar/topbar, forms, validators, responsive layout, image controls, customization UI, service modules, types, styling, assets, manifests and unit tests. The destination's existing `.git` metadata was preserved. Source `node_modules`, builds, caches, logs, `.env` values and Git metadata were not cloned. Dependencies were subsequently installed locally and remain ignored.

The existing **public** project's Git index already tracks `.env` and 2,373 generated files under `node_modules`/`dist`. The new `.gitignore` protects newly created files but cannot remove existing tracked entries. No commit or Git-index mutation was performed. `CLOUDFLARE_DEPLOYMENT_GUIDE.md` includes the exact local untracking command to run before a push, plus provider-key rotation guidance if the existing email key was previously shared.

Historical setup migrations were replaced with an ordered fresh-project setup derived from their DDL and service requirements. Destructive reset/sample migrations and historical SQL test fixtures that authorized every signed-in account were not retained as runnable setup. Equivalent current PostgreSQL tests live in `tests/database.test.mjs`.

Changes include:

- Top Cloud application names, page titles, logos, favicon, contact defaults and initial hero slides.
- Environment-only Supabase clients requiring `VITE_SUPABASE_PUBLISHABLE_KEY`; no hardcoded production URL or fallback key.
- Explicit administrator membership checks in login, protected routes, RLS, Storage and privileged publication RPCs.
- A self-contained dashboard Pages Function for review import, replacing its dependency on the reference public project's filesystem/API. It forwards the administrator's verified Supabase token and uses the publishable key. The original business ID and testimonial fallback were removed.
- Public tour data adapters, configured/empty/error states, published homepage context and shared contact bindings.
- Durable booking/inquiry storage in the public contact Function, using the existing email templates and optional Resend notifications. The Node/Vite adapter delegates to that same implementation.
- A package-image cleanup guard retaining assets still referenced by duplicated packages or homepage snapshots, and rejecting Storage URLs belonging to a different project.
- Namespaced dashboard local storage and public analytics identifiers; the public client does not persist dashboard Auth sessions.
- Small cancelable effect-start/preview updates and caught-error fixes to resolve inherited dashboard lint failures without changing the interface.
- Compatible dependency security updates within existing version ranges. The final installs reported zero audit findings for both Top Cloud projects. No packages were updated in either reference project.

## Dashboard feature mapping

| Implemented module | Preserved behavior | New public/backend connection |
| --- | --- | --- |
| Tour packages | Create/edit/delete, publish/draft/archive, duplication, bulk operations, search/filter/order, category, duration, base/tier prices and map style | Published list/home cards/detail pages use database packages; unpublished/deleted tours do not fall back to static copies |
| Package content | Main/hero images, gallery ordering/captions/alt text, highlights, itinerary days/activities/images, route coordinates/notes/images/pin colors | Existing tour detail containers receive these fields; route map uses managed coordinates and style; activity descriptions appear in the itinerary |
| Bookings | Paginated/searchable/filterable requests, detail view, new/processed status, bulk deletion and unread badges | Public booking modal writes the new project's `form_submissions` with package UUID, chosen tier, traveler details and budget estimates |
| Inquiries | Same submission workflow filtered to inquiries | Contact form and retained inquiry modal save to the same new table, with no public list/read access |
| Analytics | Overview, per-package metrics and views over time with date filters | Public tour views/book clicks/booking submissions record events; dashboard counts actual booking/inquiry rows as in the reference |
| Customize | Draft/save/publish/reset, section order/visibility, header/logo/navigation/buttons, hero slide CRUD/reorder/activation/timing, editable content/images/footer | Published JSON and hero RPC snapshots feed the existing Top Cloud sections; drafts stay admin-only |
| Reviews | Import preview, deduplication and publication; existing review list | Authenticated dashboard importer writes the new review table; public home displays imported reviews only |

Unconfigured public development retains its local Top Cloud content. Once configured, published database results are authoritative: an empty tour table produces an empty catalogue rather than old sample packages. Optional setup file 06 imports the nine existing **Top Cloud** sample tours once, with their local wildlife/safari images and itineraries. It does not import reference-company business data. Null/unquoted prices remain “Contact us”/custom quotes; live accommodation pricing uses managed tier values rather than fabricating multipliers.

The public site refreshes on load/focus and about every 15 seconds while visible. Dashboard badge subscriptions retain their Realtime/polling workflow. Realtime publication is configured where the managed publication exists; public content synchronization does not depend solely on Realtime being available.

## Homepage mapping and preserved limits

The cloned editor retains its original preview interface; it is not a pixel-identical preview of the differently designed public site. Content keys map as follows:

| Editor content | Existing Top Cloud destination |
| --- | --- |
| `nav` | Desktop/mobile logo, links and contact button |
| `heroSlider` | Existing full-width hero, transitions, controls, title/subtitle/button, text positions and timer |
| `story` | Bespoke Experiences introduction; edited badges can appear within that section |
| `featuredTours` | Featured Safaris heading and published package cards |
| `signature` | Bespoke Safari Experiences cards, descriptions and images; entered founder details/changed image appear within that section |
| `gallery` | Existing Recent Gallery frames and copy |
| `why` | Existing Our Initiatives copy/cards/icons |
| `journey` | Existing planning CTA copy, link, background and optional changed thumbnail |
| `reviews` | Review section populated by actual imported reviews |
| `footer` | Existing footer copy/links/contact/socials; phone/email also propagate to other contact areas |
| `footerBand` | Optional changed image behind the existing footer, avoiding a replacement page layout |

Initial Top Cloud appearance is retained before content publication. Optional edited media is shown in its mapped existing section. Static service content remains independent of database content editing. The original “duplicate section” action adds a layout marker with shared content rather than a new independent content model; that original limitation is preserved. Existing map-editor bounds are Uganda-specific, even though marketing tour titles can describe other countries. The original maximum gallery/hero limits and frontend validation remain in place. Caption/alt metadata is retained in the database/admin; public tour gallery captions are not a newly added display feature.

## Database architecture and provenance

Columns/types/defaults/constraints were taken from the reference `schema.sql`, `hero-slides.sql`, `tour-analytics.sql`, `tripadvisor-reviews.sql` and their related migration files, cross-checked against both original applications' services/types. Required nullable tier prices, display order, map styling, image paths and form fields are included. Actual live database introspection was unavailable; undocumented production objects cannot be verified. No additional views/enums/Edge Functions were assumed. Status/tier/style choices use the reference text CHECK constraints.

| Table | Relationships / purpose |
| --- | --- |
| `tour_packages` | UUID PK, unique slug, publication status, pricing/content/images/order |
| `tour_gallery_images` | Package FK with cascade; image URL and metadata/order |
| `tour_highlights` | Package FK with cascade; title/description/order |
| `tour_itinerary_days` | Package FK with cascade; unique package/day number |
| `tour_itinerary_activities` | Itinerary-day FK with cascade |
| `tour_itinerary_images` | Itinerary-day FK with cascade |
| `package_locations` | Package FK with cascade; unique package/name and route order; coordinates/images/pin color |
| `form_submissions` | Nullable package FK with SET NULL; booking/inquiry data and processing status |
| `homepage_customizations` | Unique page key; separate draft/published JSON and publication timestamp |
| `homepage_customization_elements` | Unique page/section/element/publication flag; flattened content mirror |
| `hero_slider_admins` | Auth user UUID FK with cascade; explicitly enrolled dashboard administrators |
| `hero_slides` | Composite slide UUID/stage PK; unique stage/order; active flag and validated content |
| `hero_settings` | Draft/published stage PK, autoplay/timing |
| `tour_analytics_events` | Package FK with cascade; event/visitor/session/time |
| `tripadvisor_reviews` | UUID PK, unique provider review ID and review fields |

SQL files under `supabase/setup/`:

1. `01_schema.sql`: tables, relationships, checks and indexes.
2. `02_security_policies.sql`: explicit grants/RLS, `is_admin()`, compatibility `is_hero_slider_admin()`, published homepage reader.
3. `03_storage.sql`: `tour-images` and `hero-slides` bucket configuration and policies.
4. `04_functions_triggers.sql`: updated timestamps, atomic hero/homepage snapshot operations, published/editor readers, analytics recording/aggregation, Realtime publication where available.
5. `05_initial_content.sql`: empty homepage singleton with conflict-safe insertion.
6. `06_optional_top_cloud_tours.sql`: optional existing Top Cloud catalogue only; conflict-safe per-slug insertion. Reproducible through `scripts/generate-top-cloud-seed.mjs`.

RPCs used: `is_admin`, `is_hero_slider_admin`, `get_hero_slider_editor_state`, `save_homepage_with_hero`, `get_published_hero_slider`, `get_published_homepage`, `record_tour_analytics_event`, `get_tour_analytics_overview`, `get_tour_package_analytics`, `get_tour_views_over_time`. Internal `replace_hero_snapshot` cannot be called by browser roles. Publication RPCs check membership; analytics aggregations use caller permissions/RLS. Public homepage reads return published JSON only, avoiding the reference policy's exposure of the draft column.

## Local validation results

| Check | Result |
| --- | --- |
| Public `npm run build` | Passed after dependency/security updates |
| Dashboard `npm run build` | Passed after dependency/security updates |
| Dashboard `npm run lint` | Passed |
| Dashboard `npm test` | 14 tests passed |
| SQL execution | All mandatory files execute repeatedly in PGlite PostgreSQL, including after data exists; optional tour seed also repeats without duplicates/overwrites |
| Schema/query compatibility | Literal table/column SELECT projections from both Top Cloud services checked against the generated PostgreSQL catalog |
| RLS checks | All 15 tables use RLS; anonymous published-only access; draft isolation; non-admin write denial; private submission read denial; membership self-enrollment denial |
| Data lifecycle | Package/day child inserts and cascade deletion; submission processing; archived tours disappear from public reads |
| RPC checks | Atomic draft/publish separation, published hero reader, admin editor restrictions, analytics recording/aggregation and unpublished-tour event rejection |
| Storage checks | Local policy checks deny anonymous/non-admin uploads; mock hero upload/save/cleanup tests pass |
| Form/API checks | Mocked inquiry storage success, missing config, database failure, invalid type and unsigned review import rejection pass |
| Local HTTP smoke checks | Public `/`, `/tours`, `/contact` and dashboard `/login`, `/packages/test/edit` returned 200; contact GET returned 405; unsigned importer POST returned 403 |
| Cloudflare Functions compilation | Both projects compiled successfully with the official Wrangler 4.155.0 Pages Functions builder; no account login or deployment |
| Dependency audits | Both compatible `npm audit fix` runs reported zero vulnerabilities |
| Original file comparison | 288 identical file contents; one original asset path difference as documented above |

Both builds emit a bundle-size warning; this is a non-failing optimization opportunity. No unrelated architectural refactor was introduced to eliminate it. The public project has no lint script; its TypeScript build was run. HTTP 200 checks confirm development route serving, not rendered visual correctness or successful authentication.

PGlite tests use a real local PostgreSQL engine with minimal stand-ins for Supabase-managed Auth/Storage schemas. They do not contact Supabase, send email, scrape live reviews or prove managed API behavior. The browser tool stopped because it could not confidently determine Chrome's current URL; no desktop/mobile screenshot or interactive visual QA was completed.

## Manual setup and remaining live checklist

Follow `SUPABASE_SETUP_GUIDE.md`, then `CLOUDFLARE_DEPLOYMENT_GUIDE.md`. The owner must create the new Supabase project, run SQL 01–05 (optionally 06), create/enroll an Auth administrator, and add the same new Project URL/publishable key to both frontends and their Functions. Configure email only if notifications are wanted. No privileged Supabase credential is needed.

The following checks remain **pending against the actual new project**:

- Admin login/logout, expired sessions and rejection of an authenticated non-admin.
- Every dashboard route and responsive view.
- Package create/update, prices/tiers, ordering, duplication, publish/archive/delete and corresponding public visibility.
- Gallery, hero and itinerary image uploads, replacement, cleanup and cross-package shared-image retention through real Storage APIs.
- Itinerary activities and route locations, pin colors, notes/images and map styles.
- Homepage Save Draft without public changes, publication, reset, visibility/order, header/footer/contact changes and hero playback at desktop/mobile widths.
- Review import preview/publication using Top Cloud's own provider page; upstream anti-scraping restrictions may prevent import and must not trigger another company's fallback data.
- Actual booking/inquiry submissions, package association, status processing, unread counts and optional email notification delivery.
- Actual analytics and Realtime subscriptions, including permissions through managed Supabase APIs.
- Direct anonymous/non-admin REST/RPC/Storage access checks confirming writes and private reads are blocked.
- Both Cloudflare deployments, Function routes, deep-link refreshes, Auth redirect configuration, environment isolation and absence of privileged frontend values.
- Browser visual verification that public styling, animations and responsiveness remain correct.

Final live verification must use only the new Top Cloud project and disposable test content. No test should call the Uganda Family Tours production database. The two systems share implementation patterns only; they do not share runtime data or credentials.
