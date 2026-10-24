# Eyaelo SIM Manager — first real airtime test

This guide is for the separate `eyaelo-sim-manager` Worker only. Do not change the construction website Worker.

## What is now implemented

- Reloadly sandbox stays separate from Reloadly LIVE.
- The dashboard can load the LIVE South African operator catalogue and has a distinct red LIVE top-up button.
- Live top-ups require LIVE credentials plus the explicit `ENABLE_LIVE_AIRTIME_RECHARGES=true` gate.
- The first live test is hard-capped at R20 and requires a dashboard confirmation.
- A transaction row and unique idempotency key are saved before submitting to the provider.
- If the request times out or its outcome is uncertain, the transaction is marked `unknown`; do not send another top-up until checking its provider status.
- The status endpoint selects sandbox or live based on the saved transaction provider.
- LIVE calls use Reloadly's production API and spend real Reloadly wallet funds. They are not simulated.

## Required Reloadly account setup

1. Sign in to the Reloadly developer portal.
2. Confirm that the Airtime product is enabled for the account and the LIVE wallet has enough balance for a small test.
3. Copy the **LIVE** Airtime API client ID and client secret from the LIVE environment. Do not use the TEST/Sandbox credentials here.
4. Confirm the account's registered country/currency and that the desired South African operator is available in the LIVE operator catalogue.

Reloadly's official guide confirms that production credentials and endpoints make real top-ups and spend the real wallet balance: https://support.reloadly.com/getting-started-send-your-first-api-request

## Configure secrets on the dedicated Cloudflare Worker

In Cloudflare Dashboard, open **Workers & Pages → eyaelo-sim-manager → Settings → Variables and Secrets**. Add these as secrets, not as source-code values:

- `RELOADLY_LIVE_CLIENT_ID` — LIVE Airtime client ID
- `RELOADLY_LIVE_CLIENT_SECRET` — LIVE Airtime client secret

Add the explicit live gate as a Worker variable:

- `ENABLE_LIVE_AIRTIME_RECHARGES` = `true`

Keep `RELOADLY_TEST_CLIENT_ID` and `RELOADLY_TEST_CLIENT_SECRET` as separate sandbox credentials. Never put secrets in GitHub commits, dashboard HTML, or chat.

The deployment workflow deploys only the SIM Manager Worker. After the new commit deploys, reconnect to the dashboard and inspect provider status. If the LIVE catalogue still cannot load, stop and resolve the provider credentials/account setup before sending anything.

## Safe first test

1. Use a phone number you control and can immediately check. A newly activated number is fine if the SIM is fully active and the provider recognises the operator.
2. In SIM Manager, register the exact number and select its actual network. Confirm the record is active.
3. Connect with the administrator token.
4. Click **Load LIVE operators** and select the operator that matches the number's real network.
5. Select R5 or R10 for the first test (the API hard cap is R20).
6. Press the red LIVE button only after checking the number, network, amount, and the warning. This sends a real top-up and spends wallet funds.
7. Check the transaction status and verify the recipient phone's airtime balance or airtime confirmation message.

A number can be syntactically valid but still be ported to another network or unsupported by the provider. If the operator match is unclear, do not submit. Do not retry after a timeout until the original transaction has been reconciled; duplicate live top-ups can spend money twice.

## Important limits

- This is a real airtime delivery provider adapter, not a direct MTN/Vodacom/Cell C/Telkom core-network OCS integration.
- SigScale OCS is being developed separately as Eyaelo's charging engine; it does not itself put airtime on a retail SIM.
- A successful API response is not enough on its own to claim the user received airtime. Confirm provider status and the recipient's actual balance/message.
- The live gate should be turned off after the controlled test by changing `ENABLE_LIVE_AIRTIME_RECHARGES` away from `true` until more live testing is intentionally required.
