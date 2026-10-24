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


## TMF654-style charging-engine test (new)

The admin dashboard now includes **Eyaelo TMF654-style charging-engine test — SIMULATED**. This is a deliberately limited, internal subset shaped around TM Forum TMF654 Prepay Balance Management; it is not a claim of full TMF654 conformance and it is not a carrier integration.

### Balance adjustment

Authenticated request:

`POST /tmf-api/prepayBalanceManagement/v4/balanceAdjustment`

Example JSON:

```json
{
  "amount": { "units": "cents", "amount": 1000 },
  "product": { "id": "+27821234567" },
  "network": "Vodacom",
  "externalId": "eyaelo-tmf-unique-reference",
  "description": "Internal development test",
  "@type": "AdjustBalance"
}
```

In this prototype, `product.id` is the phone-format identifier for an Eyaelo simulated account, and `network` selects the internal balance namespace. Use a fresh `externalId` for every intended adjustment. Reuse is rejected with HTTP 409 and no additional balance is added. Valid amounts are 100–100000 cents (R1–R1000).

A successful response contains a transaction ID, status, amount, product identifier, network, updated internal balance, `simulationOnly: true`, and `realCarrierCredit: false`.

### Read a simulated balance bucket

Authenticated request:

`GET /tmf-api/prepayBalanceManagement/v4/bucket?product.id=%2B27821234567&network=Vodacom`

The response contains a TMF654-shaped bucket representation and explicitly marks it as simulated. It reads only Eyaelo's internal D1 data.

### Manual test plan

1. Open the dashboard and connect with the admin token.
2. Use the new TMF654-style charging-engine section with a test phone-format identifier.
3. Add R10.00; expect a successful adjustment and an internal balance of R10.00 if that account/network started at zero.
4. Run another adjustment of R5.00 with a new request; expect R15.00.
5. Retrieve the bucket using the GET route above (the dashboard's read-only fetch is not yet exposed as a separate button).
6. To verify duplicate protection at API level, repeat the exact same JSON `externalId` through an authenticated API client; expect HTTP 409.
7. Check that the response always says `simulationOnly: true` and `realCarrierCredit: false`.

### Boundary

The API is a development implementation of a small TMF654-shaped subset, not the complete standard and not a public operator endpoint. The TM Forum standard defines prepaid balance operations, but a compatible request only adjusts the balance system receiving that request. It cannot change MTN, Vodacom, Cell C or Telkom balances unless a separately implemented and configured integration reaches the operator's actual charging/recharge system. Live recharge remains disabled.
