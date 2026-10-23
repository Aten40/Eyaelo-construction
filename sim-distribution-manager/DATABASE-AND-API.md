# Eyaelo SIM Distribution Manager — database and API

This application remains isolated on the feature branch. It must not be merged into or deployed with the construction website without review.

## D1 database
Apply `schema.sql` only to a **new, dedicated D1 database for the SIM manager**. Never point it at the construction website database.

The schema separates SIM inventory, airtime top-ups, verified network activity, commission statements, and audit events. Amounts are integer South African cents (R10.00 is 1000 cents). A top-up does not prove qualifying usage or commission earned; commission must be reconciled against genuine provider/network statements.

## Planned API
- `GET /api/health` — public, non-sensitive readiness check.
- `GET /api/sims` — authenticated, paginated SIM register.
- `POST /api/sims` — validate and create a SIM record; audit the action.
- `PATCH /api/sims/:id` — update permitted fields; audit the action.
- `GET /api/recharges` — authenticated recharge history.
- `POST /api/recharges` — create a draft recharge request only. It must not contact any provider until a reviewed provider connector is explicitly enabled.
- `GET /api/reports/summary` — totals from stored records; never estimate commission from top-up values alone.

## Before deployment
1. Create a separate D1 database and bind it only to this Worker.
2. Protect the Worker with Cloudflare Access or an equivalent reviewed authentication system. Do not deploy an open admin API.
3. Keep provider credentials in Worker secrets, never in browser code or Git.
4. Configure allowed origins and rate limits.
5. Use sandbox credentials where the provider offers them; otherwise stay in demo mode.
6. Test migrations and API routes against a non-production database.
7. Add backup, retention, monitoring, and reconciliation procedures.

The current HTML prototype uses local browser state only. This schema/documentation do not create a live service, and no real airtime is sent.
