# Airtime provider integration — SIM Manager

This is the separate Eyaelo SIM Distribution Manager. Its Worker is deployed at https://eyaelo-sim-manager.martinelolu30.workers.dev/. Do not merge this into the construction website's default branch or change the construction Worker.

## Current deployed state
- The dashboard and server-side API are connected to the Reloadly Airtime API adapter.
- The Worker supports sandbox operator discovery, simulated top-up submission, and sandbox transaction-status checks.
- The existing SIM register, D1 database, and ADMIN_API_TOKEN binding were preserved during deployment.
- The adapter defaults to sandbox mode. Live recharge is explicitly disabled in the API.
- Reloadly sandbox credentials have not been configured yet, so provider calls will report that the provider is not configured until the secrets are added.
- Sandbox results are simulations and do not credit a physical SIM or prove a subscriber balance.

## Add sandbox credentials
In the Reloadly developer dashboard, select the **Test/Sandbox** environment and find the Airtime API client ID and client secret. In Cloudflare, open the Worker **eyaelo-sim-manager** → Settings → Variables and Secrets, then add these as **secrets** (not plain text variables):
- `RELOADLY_TEST_CLIENT_ID`
- `RELOADLY_TEST_CLIENT_SECRET`

Do not paste credentials into ChatGPT, source code, GitHub, or the dashboard. After adding secrets, open the app, connect with the administrator token, and choose **Load sandbox operators**. Then a sandbox test can be sent from a registered SIM record.

## What the test means
- A provider status such as SUCCESSFUL is a successful sandbox simulation only.
- It does not add airtime to the real SIM or verify a live account balance.
- Live provider credentials and live top-ups are not enabled in this deployment.

## Before any real recharge is enabled
1. Confirm operator IDs from the provider catalogue and match the selected operator to the registered SIM network.
2. Review and enable a separately controlled live-recharge path only after the owner has explicitly authorised the live provider account and spending limits.
3. Persist each transaction before sending, use a unique idempotency reference, and reconcile ambiguous timeouts before retrying.
4. Mark transactions successful only from provider-confirmed terminal status; label sandbox transactions clearly.
5. Add daily limits, duplicate protection, monitoring, and a documented reconciliation process.

## Investigating direct carrier access
We will continue investigating official MTN, Vodacom, Cell C and Telkom developer/partner interfaces. Direct recharge requires authorised access to carrier charging systems; we will not pretend an unauthorised or simulated call credited a real SIM.
