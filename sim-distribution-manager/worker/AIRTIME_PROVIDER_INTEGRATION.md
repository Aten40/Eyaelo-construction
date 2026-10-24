# Airtime provider adapter — integration notes

This folder is the separate Eyaelo SIM Distribution Manager. Do not merge it into the construction website's default branch or change the construction Worker.

## Current stage
- The Reloadly adapter module is prepared for integration with the recharge API.
- It supports sandbox/live endpoint selection, token exchange, South African operator discovery, top-up submission, and status lookup.
- The module is not yet wired into the dashboard/API, and no airtime transaction has been sent.
- Sandbox responses are simulations. They do not credit a physical SIM or prove a real subscriber balance.

## Credentials
Use Cloudflare Worker secrets, never source code, browser storage, GitHub, or plain `vars`:
- `RELOADLY_TEST_CLIENT_ID`
- `RELOADLY_TEST_CLIENT_SECRET`
- `RELOADLY_LIVE_CLIENT_ID`
- `RELOADLY_LIVE_CLIENT_SECRET`

Set `AIRTIME_PROVIDER_MODE` to `sandbox` for testing. Live mode must only be enabled after testing and explicit owner configuration. Test and live credentials are separate. Do not paste secrets into ChatGPT.

## Before any real recharge is enabled
1. Wire provider calls into a server-side API route only.
2. Discover and verify the South African operator IDs from the provider catalogue; never guess IDs.
3. Persist a unique transaction record before sending, then store provider transaction IDs and status.
4. Add a duplicate guard and daily amount/transaction caps.
5. On timeouts, check provider status/reconcile before retrying.
6. Mark a recharge successful only from a provider-confirmed terminal status. A sandbox success is labelled sandbox only.
7. Keep live orders disabled until the owner explicitly enables them and the funded provider account is verified.

## Can we recharge without a provider?
A direct network API is possible only if a carrier grants Eyaelo authorised access to its recharge/charging system (for example, a carrier partner API or enterprise interface). There is no legitimate universal public endpoint that can add value to arbitrary SIMs for free or bypass network access controls. We will keep investigating official carrier/developer routes separately while this integration is built.
