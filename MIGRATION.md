# ekklo. GitHub Pages and Supabase

The frontend is built for `https://joseph1234-web.github.io/LIGHT/`. The dedicated
Supabase project is `yznhkfyctmsmkeibepsh`; the existing RoboSync project is separate.

## Build and publish

`npm run check:postgres` runs the application integration checks, replays their
SQLite operations against Postgres, and verifies backend authentication and account
isolation. `npm run build:pages` creates `dist/pages`; `npm run build:backend`
creates the `ekklo-api` Edge Function bundle in `dist/edge`.

GitHub Pages uses the **GitHub Actions** publishing source in repository Settings.
The Pages workflow verifies and deploys the frontend when `main` changes. The
backend is a separate deployment: changing its source in GitHub does not deploy an
Edge Function automatically. No production secret belongs in GitHub or a build
artifact. Only the public project URL and publishable key appear in the frontend.

## Accounts and private data

The standalone website uses Supabase email/password sign-in. Configure the Auth
Site URL and permitted redirect URL as the exact frontend URL above. Keep email
confirmation enabled. An existing account's confirmed email maps to its original
workspace owner identifier, preserving saved schedules, templates, account
connections, and publishing history. Users create a password for the new sign-in;
their ChatGPT password is never collected or transferred.

Application tables live in `ekklo_private`, with browser-role privileges revoked
and RLS enabled. Authenticated API requests verify the caller with Supabase Auth
and filter records by the mapped workspace owner. Caller-supplied Sites identity
headers are removed. Media is kept in the private `ekklo-private` storage bucket
and is served through authenticated endpoints.

## Controlled cutover

The backend starts with `ready=false` and its own scheduler paused. The original
site remains the working service until the destination is verified.

1. Deploy the protected read-only export to the original host. Keep the existing
   Site access policy and its encryption key unchanged.
2. Verify the standalone frontend and backend health. Configure Auth redirects.
3. Pause writes on the original workspace, copy each table in resumable pages,
   and copy each referenced media object into private storage.
4. Compare source and destination row counts, verify private object sizes and
   encrypted account configuration, and map the original account emails.
5. Only after verification, mark the destination ready, forward the original
   Site plugin to the authenticated backend bridge, and resume the existing
   account-bound cloud checks. Never run two independent live queues against
   diverging databases.
6. Disable the one-time export and remove temporary migration credentials.

Migration state and copied-object receipts persist in Postgres. A failed step
does not mark the workspace ready or repeat an uncertain social delivery. The
original database and media remain available for recovery. Pending OAuth login
attempts and expired runner locks are not moved.

Existing social connections remain encrypted under the original encryption key.
Provider developer apps need the new exact callback URLs shown in Connections
before starting a new authorization on the standalone site. Never replace a
working saved account merely to test the migration.
