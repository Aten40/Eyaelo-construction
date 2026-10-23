# SIM Manager API Worker (not deployed)

This is a separate Cloudflare Worker project and must remain independent of the construction website Worker.

## Current API behaviour
- Authenticates protected routes with a server-side `ADMIN_API_TOKEN` secret.
- Uses a strict configured `APP_ORIGIN` for browser CORS.
- Supports SIM list/create/update, recharge list/create-draft, and summary reports.
- Recharge creation writes a `draft` only. It never calls an airtime provider.
- Never infer network usage or commission from recharge amounts.

## Setup — do not deploy until all placeholders are replaced
1. In Cloudflare, create a **new D1 database** named `eyaelo-sim-manager-db`. Do not reuse the construction website database.
2. Copy its ID into `wrangler.jsonc` as `database_id`.
3. Set `APP_ORIGIN` to the final, exact origin of the separately hosted SIM-manager UI (no path or trailing slash).
4. Install dependencies in this directory: `npm install`.
5. Apply the schema from the parent folder to the new database:
   `npx wrangler d1 execute eyaelo-sim-manager-db --remote --file=../schema.sql`
   Confirm the database name and ID before running the command. For initial testing, use `--local` without `--remote`.
6. Set the secret interactively: `npx wrangler secret put ADMIN_API_TOKEN`. Use a long random token and never commit it or send it in chat.
7. Test locally with `npm run dev` and `npm run check`. Confirm that unauthenticated protected routes return 401, allowed-origin requests work, disallowed origins are rejected by CORS, invalid payloads are rejected, and duplicate idempotency keys do not create duplicate transactions.
8. **Before deployment**, put the admin UI behind Cloudflare Access or another reviewed identity/session layer. The bearer token mechanism is a foundation for controlled server-to-server/admin testing, not a substitute for a complete user/session system. Do not embed a permanent API token in public browser JavaScript.
9. Deploy only after review: `npm run deploy`. This does not deploy the existing construction site, but it will publish this Worker if invoked.

## Important limitations
- No user/password login, sessions, role management, provider connector, provider callbacks, or real recharge submission is implemented.
- The API is not production-ready until rate limiting, robust authentication/session design, duplicate-idempotency error handling, backups, monitoring, and automated tests are completed.
- The Wrangler config contains deliberate placeholders. Do not deploy while any placeholder remains.
- Provider secrets must be stored with Worker secrets and must never be exposed to browser code.
