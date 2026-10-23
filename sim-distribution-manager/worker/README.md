# SIM Manager API Worker (deployed draft-only test build)

Deployed separately at `https://eyaelo-sim-manager.martinelolu30.workers.dev/`. It remains independent of the construction website Worker. Source is on the `feature/sim-distribution-manager-foundation` branch.

## Current deployed behaviour
- The dashboard is served by this Worker and calls its API on the same origin.
- Paste the administrator token into the dashboard to connect. The page does not save the token in browser storage; disconnect clears it from the page.
- The private token is stored as a Cloudflare Worker secret named `ADMIN_API_TOKEN`. The initial token was supplied to the owner in the deployment conversation; keep it private and rotate it if it is exposed.

## Current API behaviour
- Authenticates protected routes with a server-side `ADMIN_API_TOKEN` secret.
- Serves the dashboard and API from the same origin, so cross-origin browser access is not needed.
- Supports SIM list/create, recharge list/create-draft, and summary reports. SIM update is not yet exposed in the deployed API.
- Recharge creation writes a `draft` only. It never calls an airtime provider.
- Never infer network usage or commission from recharge amounts.

## Operations and remaining hardening
1. The dedicated D1 database `eyaelo-sim-manager-db` is created and the five-table schema is applied.
2. The Worker is deployed independently from the construction website and uses the dedicated D1 binding.
3. The `ADMIN_API_TOKEN` secret is configured in Cloudflare.
4. Before wider use, add Cloudflare Access or a reviewed identity/session layer, rate limiting, automated tests, backups, and monitoring.
5. Do not use real customer SIM data until security and privacy controls have been reviewed. Never store PINs, PUKs, OTPs, or banking credentials.

## Important limitations
- No user/password login, sessions, role management, provider connector, provider callbacks, or real recharge submission is implemented.
- The API is a draft-only test build, not production-ready. Add rate limiting, robust authentication/session design, stronger audit actor identity, backup/restore, monitoring, and automated tests before wider use.
- The Wrangler development config still contains an `APP_ORIGIN` placeholder and is not the deployment mechanism used for the current direct API deployment. Replace it before using Wrangler to deploy.
- Provider secrets must be stored with Worker secrets and must never be exposed to browser code.
