The reference project's fixtures assumed that all authenticated users were administrators. They have been replaced with `tests/database.test.mjs`, which runs the complete ordered setup in a disposable PGlite PostgreSQL database and tests separate anonymous, non-admin and administrator roles.

Run `npm test` from the dashboard directory. Do not create fake `auth` or `storage` schemas inside Supabase. The stand-ins used by the local test exist only in its in-memory database.
