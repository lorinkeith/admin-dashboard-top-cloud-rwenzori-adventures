# Supabase setup for Top Cloud Rwenzori Adventures

Both applications now have synchronized frontend and server Supabase variables in their local `.env` files. Existing email variables were preserved. A read-only API check on 2 November 2026 reached the configured project, but `tour_packages` returned HTTP 404 / `PGRST205` (table missing from the API schema cache). Database setup and administrator enrollment are still required; a working website/dashboard round trip has not yet been verified.

## Finish your current setup

**Contact inquiry update:** Contact-page and popup inquiries now insert directly into `form_submissions` through the public website's Supabase client, with `type = 'inquiry'`. The anonymous insert policy keeps these records private and the dashboard's Inquiries filter displays them to administrators. Inquiry saving requires the two `VITE_SUPABASE_*` settings and no contact server or email credentials. These direct inquiry saves do not send email notifications. Booking requests continue to use `/api/contact` and its server settings. A labeled “Contact form integration test” inquiry was successfully saved using the current submission code.

1. Open **your configured Top Cloud project** in Supabase, then **SQL Editor**. Paste and run the entire [`supabase/RUN_THIS_SETUP.sql`](supabase/RUN_THIS_SETUP.sql). It bundles files 01–05 below into one transaction. Use either the bundle or the numbered files. The publishable key cannot create tables; this step runs in SQL Editor under your project owner account.
2. To keep the website's existing nine starter tours, run [`supabase/setup/06_optional_top_cloud_tours.sql`](supabase/setup/06_optional_top_cloud_tours.sql). Otherwise the connected public catalogue stays empty until you publish tours in the dashboard.
3. In **Authentication → Users**, create your administrator email/password user. Confirm the `admin_email` in [`supabase/ADD_ADMIN.sql`](supabase/ADD_ADMIN.sql) matches your Auth account and run that file. It looks up the UUID automatically and reports an error if the account is absent. Enable email/password sign-in and disable public signups in Auth settings. This membership grants access to all dashboard modules.
4. Run [`supabase/VERIFY_SETUP.sql`](supabase/VERIFY_SETUP.sql) in SQL Editor. Every returned check should be `true`.
5. From the dashboard folder, run `npm run supabase:check`. This compares the effective development/production settings in both apps, checks public table columns and homepage RPCs, and verifies anonymous users cannot read private tables. It prints no credentials or records. `npm run supabase:check -- --env-only` checks local settings without network access.
6. Restart both development servers: website `npm run dev -- --port 5180`, dashboard `npm run dev -- --port 5181`, each from its own folder. Sign into the dashboard with your Auth user's email and password.
7. Create a draft tour with an image, itinerary and route point. Confirm it is hidden publicly, then publish and reload the website. Edit and publish homepage content and confirm the website changes. Send a test inquiry and booking from the public website, confirm both appear in the dashboard, then mark them processed. Confirm analytics update after visiting a published tour. These are deliberate manual tests; the connection checker creates no records.

For deployment, set all four Supabase variables in **both hosting projects**, including runtime variables for the Pages Functions; local `.env` files are not deployed. Keep contact/review API URLs empty for same-origin endpoints. Build and redeploy after changing `VITE_*` values. Optional email notifications also need `CONTACT_EMAIL`, a verified `RESEND_FROM_EMAIL`, and `RESEND_API_KEY` on the website's server. Existing email settings were retained; email delivery has not been tested.

The combined SQL targets a fresh or compatible Top Cloud schema. If you already ran different migrations and see a missing-column or incompatible-function error, keep the exact error and reconcile that schema before rerunning. Do not reset an existing database to make setup pass.

Regenerate the bundle after editing the numbered SQL sources with `npm run supabase:bundle`.

## 1. Create the independent project (skip if already created)

1. Sign into the Supabase Dashboard and select **New project**.
2. Choose your organization, name the project **Top Cloud Rwenzori Adventures**, choose a suitable region and create a strong database password. Keep that password in your password manager; never add it to either frontend.
3. Wait for provisioning. Check the project name and project reference before every SQL operation. Do not select the Uganda Family Tours project.
4. This is an independent system: do not restore the original database backup, import customer records, copy Auth accounts, or reuse the original environment files.

## 2. Run the SQL in dependency order

Open the new project's **SQL Editor**, create a new query, paste the complete contents of one file and click **Run**. Wait for success before proceeding.

| Order | File inside this dashboard | Creates/configures |
| --- | --- | --- |
| 1 | `supabase/setup/01_schema.sql` | 15 application tables, keys, constraints and indexes |
| 2 | `supabase/setup/02_security_policies.sql` | Explicit permissions, RLS, administrator checks, published homepage reader |
| 3 | `supabase/setup/03_storage.sql` | Two marketing-image buckets and upload/delete policies |
| 4 | `supabase/setup/04_functions_triggers.sql` | Atomic homepage/hero publication, analytics RPCs, timestamps and Realtime publication |
| 5 | `supabase/setup/05_initial_content.sql` | Empty homepage singleton only; no imported customer or business records |
| 6, optional | `supabase/setup/06_optional_top_cloud_tours.sql` | The existing nine Top Cloud public sample tours, published with their current tour/wildlife images and itineraries |

Run **all five files or the combined setup before using the connected apps**. The scripts are intended for this fresh project. They do not drop application tables, truncate data, reset analytics or overwrite existing content. Reapplying them recreates the named policies/functions/triggers and leaves records in place; `CREATE TABLE IF NOT EXISTS` is not a migration tool for an unrelated or partially incompatible database. Do not run historical reference migrations alongside these files.

To retain the website's current catalogue in the database, also run optional file 06 after file 05. It copies only the existing **Top Cloud** public content and creates missing slugs with their child records once. It never replaces an existing package. Review starter descriptions/prices before using them as commercial offers. Original budget/luxury multipliers were estimates; the seed stores the existing base price as the standard/mid-range price and leaves other tiers unquoted. Images use the `/brand/` assets deployed in both applications. Skip file 06 if you want to create all packages yourself.

The SQL does not create or alter `auth.users`. It only references it through a foreign key. Supabase supplies the Auth and Storage system structures.

## 3. Check Storage

In **Storage**, confirm these buckets exist:

| Bucket | Public | Maximum file | Accepted MIME types |
| --- | --- | --- | --- |
| `tour-images` | Yes | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` |
| `hero-slides` | Yes | 5 MB | `image/jpeg`, `image/png`, `image/webp` |

The scripts create buckets only if absent. If a bucket was created manually, match these limits in its Dashboard settings. Public buckets are for public marketing assets, including images uploaded during draft editing; draft images are not confidential. Only enrolled administrators can upload or delete. The applications upload through the Storage API; never remove object rows manually through SQL.

Paths retained from the reference:

- `tour-images/packages/<slug-or-id>/main|hero|gallery/...`
- `tour-images/packages/<id>/itinerary/day-<n>/...`
- `tour-images/packages/<id>/route/day-<n>/...`
- `tour-images/customize/home/<section>/...`
- `hero-slides/home/<uuid>.jpg|png|webp`

Bucket names match the implementation. Their contents are isolated because the buckets belong to the new project, with a different project URL and Auth system.

## 4. Configure Auth and the first administrator

1. In **Authentication → Providers / Sign In**, enable email/password authentication and disable public user signups. The dashboard provides password login/logout; it has no public registration or user-management feature.
2. In **Authentication → URL Configuration**, set **Site URL** to the dashboard's eventual HTTPS origin. During local work use `http://localhost:5181` if that is the origin you actually use.
3. Add the exact local and deployed dashboard origins/redirect paths used by invitation or recovery links. Do not add Uganda Family Tours URLs or broad wildcard domains. Password sign-in itself does not require an OAuth callback.
4. In **Authentication → Users**, create or invite your own first administrator. Complete password creation yourself through the Dashboard or invitation flow. Configure Auth email delivery if invitations require it.
5. Copy that user's UUID from **Users**. In **SQL Editor**, replace the placeholder below with that UUID and run:

```sql
insert into public.hero_slider_admins (user_id)
values ('REPLACE_WITH_YOUR_NEW_TOP_CLOUD_AUTH_USER_UUID'::uuid)
on conflict (user_id) do nothing;
```

`hero_slider_admins` is the administrator membership table retained from the reference migration. In this system its membership authorizes **all dashboard modules** through `is_admin()`. Its historical name does not limit it to the hero editor. Anonymous and authenticated browser users cannot insert, update or delete memberships. Do not add an administrator flag to user-editable metadata.

To authorize another administrator, create that user's Auth account in this same new project and repeat the SQL with the new UUID. To revoke an administrator, the project owner removes only that membership in SQL Editor. There is no hardcoded administrator password or automatic signup-to-admin trigger.

## 5. Find the public connection information

Open the project's **Connect** dialog or **Project Settings → API / API Keys**. Copy:

- **Project URL**, such as `https://<new-project-reference>.supabase.co`.
- **Publishable key**, beginning with `sb_publishable_`.

Both frontends intentionally accept the new publishable-key format. Do not use a secret key, service-role key, database password or legacy privileged JWT. A publishable key is visible in browser builds; RLS and administrator membership enforce authorization. See [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 6. Configure both local applications

Inside **each** of these folders, copy `.env.example` to an ignored `.env.local`:

- `top-cloud-rwenzori-adventures`
- `top-cloud-rwenzori-adventures-admin-dashboard`

Put the **same new Top Cloud values** in both:

```env
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_REFERENCE.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_NEW_PUBLIC_KEY
```

Do not leave placeholder values in a deployed build. Invalid/missing frontend configuration leaves the public site in its local content mode and prevents dashboard login; it never falls back to another project's credentials. The current local public website's existing email `.env` was not copied into the admin project. Replace obsolete local email settings explicitly with the names below.

The server-side Pages Functions also need the same project's public connection values. For Vite development, add these to the appropriate ignored `.env.local`; for `wrangler pages dev`, copy `.dev.vars.example` to ignored `.dev.vars` instead:

```env
SUPABASE_URL=https://YOUR_NEW_PROJECT_REFERENCE.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_NEW_PUBLIC_KEY
```

Add those two server variables to **both projects**: the public site's contact endpoint stores submissions, and the dashboard's review importer forwards the signed-in administrator's bearer token. Neither endpoint needs a privileged Supabase key.

Optional public-site email notifications use server-only variables:

```env
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=Top Cloud Rwenzori Adventures <YOUR_VERIFIED_SENDER>
CONTACT_EMAIL=info@topcloudrwenzoriadventures.com
```

Configure your verified sending domain/address with Resend. The named mailbox must exist independently. Database storage is authoritative: if email is not configured or fails, a successfully saved submission still returns success and remains visible in the dashboard. If database storage fails, the endpoint returns an error. Old recipient variable aliases are intentionally ignored.

Leave `VITE_CONTACT_API_URL` and `VITE_REVIEW_IMPORT_API_URL` blank for same-origin endpoints. `VITE_PUBLIC_SITE_URL` is informational/available for public-site links; the review importer now runs on the dashboard's own origin.

Restart Vite after changing environment files. Vite values are compiled at build time, so changing them on Cloudflare requires a new build/deployment.

## 7. Start locally

In separate VS Code terminals, enter the correct folder first:

```powershell
cd top-cloud-rwenzori-adventures
npm ci
npm run dev -- --port 5180
```

```powershell
cd top-cloud-rwenzori-adventures-admin-dashboard
npm ci
npm run dev -- --port 5181
```

Vite serves the contact endpoint and review importer during local development. A static `vite preview` serves only frontend output and is not a Pages Functions emulator. Use `wrangler pages dev dist` from the relevant project for a Cloudflare-style local check after building.

## 8. Verify setup before real content

In SQL Editor:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

select user_id, created_at from public.hero_slider_admins;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id in ('tour-images', 'hero-slides');
```

There should be 15 application tables with RLS enabled. Confirm the enrolled administrator UUID matches the new project's user. SQL Editor runs with owner privileges, so a successful owner query does **not** prove anonymous access is restricted.

Then use a normal browser/private window and follow the live verification checklist in `INTEGRATION_REPORT.md`. Start with a new test package containing your own Top Cloud text and wildlife/tour image, publish it, and confirm it appears on the public site. Configured sites have **no published packages** until you create them or run optional file 06; existing local sample tours are not silently imported. Publishing a homepage draft is separate from publishing a package. The public site refreshes database content on page load, focus and approximately every 15 seconds while visible.

Run `npm test`, `npm run lint`, and `npm run build` in the dashboard. Run `npm run build` in the public project. Local PostgreSQL tests use simulated Supabase system schemas and cannot prove the real Auth/Storage transport or Realtime behavior.

## 9. Information needed for final integration verification

The local Project URL and publishable key are already configured in both apps; you do not need to share them again. After running setup and enrolling your administrator, run `npm run supabase:check` and complete the browser checks above. Enter your password yourself when testing login. Deployment still needs the actual public/dashboard hosting origins and environment variables configured on the host. Never share a secret/service-role key or database password.
