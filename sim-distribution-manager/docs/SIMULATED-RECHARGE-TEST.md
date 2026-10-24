# Eyaelo internal simulated recharge test

## Purpose

This test lets the administrator enter a real-format phone number and simulate a recharge request for MTN, Vodacom, Cell C or Telkom. It validates Eyaelo's request handling, amount checks, idempotency, balance ledger and audit trail.

**It does not send airtime or data to the phone.** The resulting balance is stored only in Eyaelo's `simulated_subscriber_balances` table and is not a carrier balance. A real number is accepted as test data, but the handset will not receive airtime/SMS and the carrier account will not change.

## Dashboard use

1. Open the Eyaelo SIM Distribution Manager.
2. Connect with the existing administrator token.
3. Find **Eyaelo internal recharge test — SIMULATED**.
4. Enter a phone number in international or local digit format, select the network, choose a test amount, and submit.
5. Confirm the warning. The result displays the internal test balance and transaction ID.

No SIM register record is required for this simulator. It must never be described as a real top-up.

## API

Authenticated endpoint:

`POST /api/simulator/recharge`

JSON body:

```json
{
  "phone_number": "+27821234567",
  "network": "Vodacom",
  "amount_cents": 1000,
  "idempotency_key": "eyaelo-sim-unique-test-reference"
}
```

The request requires the normal administrator bearer token. A successful response includes `status: "simulated"`, `simulation_only: true`, `real_carrier_credit: false`, and the internal balance in cents. A repeated idempotency key returns HTTP 409 and does not add another credit.

## Recommended checks

- Submit a valid test number and amount; confirm internal balance increases.
- Submit a different test number; confirm separate balance.
- Reuse an idempotency key; confirm duplicate rejected.
- Try invalid phone, unsupported network, negative/zero amount, excessive amount and missing key; confirm rejected.
- Check the audit event for the test transaction.
- Verify no record is added to the real recharge table and no provider API is called.

## Live-network milestone

This simulator is a development step only. To deliver actual airtime, Eyaelo still needs a working integration to a carrier's or charging platform's actual recharge interface. Until then, do not collect money for a live recharge or tell a customer the carrier balance has changed.
