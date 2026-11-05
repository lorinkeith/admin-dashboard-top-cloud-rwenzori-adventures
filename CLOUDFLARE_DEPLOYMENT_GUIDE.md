# Independent Cloudflare Pages deployments

No production deployment was changed or performed. Deploy the two Top Cloud projects separately after the new Supabase setup is complete. The original projects and their hosting configurations remain unchanged.

## Build settings

Create two **Pages** projects in Cloudflare Workers & Pages. With a monorepo containing the four workspace directories, use these root settings:

| Setting | Public website | Admin dashboard |
| --- | --- | --- |
| Root directory | `top-cloud-rwenzori-adventures` | `top-cloud-rwenzori-adventures-admin-dashboard` |
| Build command | `npm run build` | `npm run build` |
| Output directory, relative to root | `dist` | `dist` |
| Node version | `22` (see `.node-version`) | `22` (see `.node-version`) |
| Pages configuration | Own `wrangler.toml` | Own `wrangler.toml` |
| Server Functions | `functions/api/contact.js` | `functions/api/fetch-tripadvisor-reviews.js` |

If each folder has its own Git repository, connect each repository separately and leave its Pages root directory empty. The existing dashboard destination already had its own `.git` directory; it was preserved. Review your repository layout before pushing. Do not upload `node_modules`, `.env*`, `.dev.vars`, logs, or original production configuration. Keep the `.example` templates.

**Existing public repository cleanup is required before pushing:** its Git index already tracks `.env` and 2,373 generated files under `node_modules`/`dist`. Adding `.gitignore` does not untrack files already in Git. No commits or index changes were made during this task. From the **Top Cloud public** project, remove only those entries from tracking (the local files remain on disk), review the staged deletions, then commit your reviewed source changes:

```sh
git rm --cached -r --ignore-unmatch -- node_modules dist .env
git status --short
```

If the existing email key was ever pushed/shared, rotate it with the provider before deployment. Do not paste the key into chat or a commit. Check tracked environment filenames before every push; never apply this cleanup command to either original reference project.

Do not copy the original Uganda deployment names, environment values or domains. The tracked Wrangler files contain no account ID, project credentials or production bindings.

## Configure environment values before the first build

For **both Pages projects**, configure these public build-time variables with the same newly created Top Cloud project:

```env
VITE_SUPABASE_URL=https://YOUR_NEW_TOP_CLOUD_PROJECT_REFERENCE.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_NEW_TOP_CLOUD_KEY
```

For the public site's contact Function and the dashboard's review-import Function, also configure runtime variables on **each** project:

```env
SUPABASE_URL=https://YOUR_NEW_TOP_CLOUD_PROJECT_REFERENCE.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_NEW_TOP_CLOUD_KEY
```

Set these in the project's Variables and Secrets settings for the appropriate production/preview environment. The Supabase key here is public. No service-role key or Supabase secret key is needed. Restrict production-connected previews to trusted administrators, or use a separate staging Supabase project for previews. Do not populate a preview with Uganda credentials.

Optional **public-site runtime secrets/settings** for notification email:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Secret configured in Cloudflare |
| `RESEND_FROM_EMAIL` | Sender verified with your email provider |
| `CONTACT_EMAIL` | `info@topcloudrwenzoriadventures.com`, once the mailbox is configured |

Use Cloudflare secret storage for the email API key. Do not prefix it with `VITE_`. Email failure does not lose a saved submission. Leave frontend endpoint overrides blank: `/api/contact` and `/api/fetch-tripadvisor-reviews` are same-origin routes on their respective applications.

## Deploy Functions as well as static assets

Use Cloudflare's Git build integration or Wrangler Pages deployment from the correct project root. A drag-and-drop static upload or generic static host can omit Pages Functions. A successful frontend build alone does not deploy the API endpoints.

Both Functions directories were compiled successfully with Wrangler 4.155.0 using `npx --yes wrangler@4 pages functions build functions --outdir .wrangler/functions-check`. This is a local compilation check and does not deploy anything. See the [official Pages CLI reference](https://developers.cloudflare.com/workers/wrangler/commands/pages/).

For CLI deployment after installing/authenticating Wrangler through the official Cloudflare workflow:

```sh
npm ci
npm run build
npx wrangler pages deploy dist --project-name YOUR_MATCHING_PAGES_PROJECT_NAME
```

Run that command inside each project separately. Creating Cloudflare projects, authenticating and executing deployment are manual actions for the project owner; these commands were not run against an account during implementation. See [Pages Functions](https://developers.cloudflare.com/pages/functions/) for supported deployment behavior.

## Routes, refreshes and origins

Both builds copy `public/_redirects` into `dist` with `/* /index.html 200`, preserving React Router refreshes such as `/tours/<slug>`, `/contact`, `/login` and `/packages/<id>/edit`. Cloudflare does not apply static redirects to requests served by Pages Functions. See [Cloudflare redirect behavior](https://developers.cloudflare.com/pages/configuration/redirects/).

Both projects also copy basic response security headers. HTTPS Pages origins can call the new Supabase HTTPS API. The browser's Supabase client uses its publishable key; dashboard writes additionally carry the Auth access token. Same-origin form/importer routes avoid cross-origin frontend API configuration. The importer retains token-based authorization even if called directly from another origin.

After assigning domains, update Supabase **Auth → URL Configuration**: set Site URL to the **admin dashboard** origin and allow only the exact local/production URLs used by Auth invitation/recovery flows. Password login/logout stay in the dashboard. Do not add the original company's domains. No OAuth provider was added by this clone.

## Deployment validation

1. Confirm both Pages projects show the expected root directory and a successful build.
2. Confirm frontend variables and Function runtime variables point to the same **new** Supabase project. Redeploy after build-time variable changes.
3. Open the public home page, tour list, a published detail page, about and contact pages at desktop and mobile widths. Check existing animations and navigation.
4. Refresh nested routes directly and confirm the app loads instead of a 404.
5. Log into the dashboard as the enrolled admin; create, edit, reorder, duplicate, archive and delete disposable test content. Confirm public updates within the refresh window.
6. Submit one test booking and inquiry. Confirm the new dashboard receives them and anonymous REST reads are denied. Confirm notification email separately if configured.
7. Test image uploads to both buckets and published image display. Test the published hero's activation, ordering, text position, autoplay and timing.
8. Test review import preview and publication with **Top Cloud's own TripAdvisor business page**. Upstream blocking can prevent scraping; no original-company review fallback is included.
9. Test unauthorized direct REST/RPC/storage operations with an anonymous client and a separate non-admin Auth account. See the integration report for the complete checklist.

Live Cloudflare builds, API routing, Auth redirects, actual Storage transport and desktop/mobile visual QA are pending. The browser tool stopped because it could not reliably determine Chrome's URL; no deployment or browser verification success is claimed.
