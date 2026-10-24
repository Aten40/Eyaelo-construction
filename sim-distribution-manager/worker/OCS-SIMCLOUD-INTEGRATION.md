# Eyaelo SIM Manager — SigScale OCS and SIMcloud integration

This branch adds two distinct integrations.

1. SigScale OCS adapter: sends a prepaid balance adjustment to a real SigScale OCS instance using its documented TMF654-style endpoint. It updates the SigScale product balance only; it does not credit a mobile operator's airtime.
2. SIMcloud live airtime adapter: sends a real South African airtime order to SIMcloud, stores the provider request ID, and supports status polling. This is the path that can credit a real mobile number when the provider token and wallet are valid.

## Environment configuration

Set these in Cloudflare Worker eyaelo-sim-manager under Settings → Variables and Secrets. Never put secrets in source control or chat.

### SigScale OCS

- SIGSCALE_OCS_BASE_URL — HTTPS base URL of a reachable SigScale OCS instance, for example https://ocs.example.net
- SIGSCALE_OCS_USERNAME — a provisioned SigScale REST API user
- SIGSCALE_OCS_PASSWORD — that user's password, stored as a secret

Endpoints:
- GET /api/ocs/status checks the OCS /health endpoint.
- POST /api/ocs/link-subscriber maps an active Eyaelo SIM to its existing SigScale product ID.
- POST /api/ocs/recharge makes an R1–R20 test balance adjustment using /balanceManagement/v1/balanceAdjustment.

Example link request:
{"sim_card_id":"Eyaelo SIM record UUID","product_id":"existing SigScale product ID"}

Example OCS test adjustment:
{"sim_card_id":"Eyaelo SIM record UUID","amount_cents":500,"idempotency_key":"eyaelo-ocs-test-unique-001"}

The SIM must already be registered as active in Eyaelo, and its matching product/service must already exist in SigScale. A successful response explicitly says real_carrier_credit: false.

## SIMcloud real airtime

- SIMCLOUD_API_TOKEN — SIMcloud bearer token stored as a Cloudflare secret.
- ENABLE_SIMCLOUD_LIVE_RECHARGES — set to true only when ready to spend the SIMcloud wallet.

Endpoints:
- GET /api/simcloud/status reports whether the token and gate are configured; it does not reveal the token or spend money.
- POST /api/recharges/submit-simcloud submits a real airtime order. It requires confirm_live: true, an active Eyaelo SIM, a unique idempotency key and an R2–R20 amount.
- POST /api/recharges/check-simcloud checks an existing order by its saved SIMcloud request ID.

SIMcloud documented endpoint: https://simcloud.co.za/api/airtime.php. It accepts msisdn, network, amount in rand, and reference. A successful HTTP response means the order was queued, not necessarily delivered. Poll status and verify the phone's balance. SIMcloud documents a five-minute duplicate window for the same number and amount; never blindly retry an unknown request.

## Four-step test plan

1. SigScale container smoke test: run the CI workflow to pull the published OCS image, initialize its database volume, start the container, and wait for GET /health.
2. OCS adapter test: configure a reachable OCS instance, link a known test product, post a small adjustment, then read the product balance in OCS. The API response is labelled OCS-only.
3. Provider integration: verify SIMcloud configuration without sending an order, then enable the gate when a funded wallet is available.
4. Live handset test: submit R2 or R5 once, poll the saved request ID, and verify the recipient phone. If status is unknown, reconcile before retrying.

## Current limitations

- The GitHub Actions OCS container is ephemeral; it is not a permanent OCS host.
- Cloudflare Worker cannot host the full Erlang/OTP OCS process itself. SigScale must run on a reachable server/container platform.
- No credentials or wallet funding are created by this code.
- The existing Reloadly live route remains separate. The SIMcloud route is an additional documented path.
