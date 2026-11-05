# Top Cloud Rwenzori Adventures Admin Dashboard

Functional clone of the reference dashboard, with independent Supabase configuration and administrator authorization.

Start with [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md). Deployment is documented in [CLOUDFLARE_DEPLOYMENT_GUIDE.md](CLOUDFLARE_DEPLOYMENT_GUIDE.md). Read [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md) for implementation details and verification limits.

```sh
npm ci
npm run dev -- --port 5181
npm run build
npm run lint
npm test
npm run verify:references
```

The last command requires the two original reference directories in the workspace. It never writes to them. Other build and runtime operations require only this project.

No credentials are included. Copy `.env.example` to `.env.local` and use the new Top Cloud project's public connection information. For local server functions, copy `.dev.vars.example` to `.dev.vars` for Wrangler; the Vite development server instead reads the same server variable names from ignored `.env.local`.
