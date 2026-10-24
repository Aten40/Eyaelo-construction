# MTN South Africa — Airtime Refill API Integration Specification

**Status:** Specification captured; implementation remains disabled pending MTN application approval and confirmation of account-specific parameters.  
**Target:** Eyaelo SIM Distribution Manager, separate from the Eyaelo Construction website.  
**Official product:** [MTN Customer Plans API v2](https://developers.mtn.com/products/mtn-customer-plans-api-v2)  
**Official OpenAPI document:** [Download Swagger](https://developers.mtn.com/products/mtn-customer-plans-api-v2/download/swagger)  
**Specification version shown by MTN:** 3.0.0, last updated 2026-10-14.

## 1. Operation confirmed in MTN's published specification

The OpenAPI specification describes the operation as **Airtime Refill** for third-party partners and says it supports airtime voucher or voucher-less recharge of a prepaid subscriber. The subscriber identifier must be an MSISDN formatted according to E.123.

- **HTTP method:** `PATCH`
- **Production base URL:** `https://api.mtn.com/v1`
- **Path:** `/customers/{customerId}/plans/refill`
- **Full URL template:** `https://api.mtn.com/v1/customers/{customerId}/plans/refill`
- **Authentication:** OAuth 2.0 bearer token via MTN MADAPI.
- **Request content type:** `application/json`
- **Path parameter:** `customerId` (required string; use the target subscriber's MSISDN in E.123 format only after MTN confirms the expected country-specific format for this operation).
- **Optional headers listed by the specification:** `channel`, `sourceSystemId`, `transactionId`, `x-authorization-claims`, `x-email-id`, `x-origin-channelid`, `x-registration-channel-id`.
- **Response:** JSON.

Do not use the APN endpoint `/api/apn-management/v1/activateservice` for airtime top-up; that is a different service family.

## 2. Request body schema published by MTN

The OpenAPI document lists these properties. It does not mark individual properties as required in the schema, so the exact minimum required fields and valid values must be confirmed from the MTN app/product documentation or MTN support before a live request.

| Field | Type | Purpose / caution |
|---|---|---|
| `refillType` | string | Refill method/type. **Allowed values not established by the published schema alone.** |
| `refillProfileId` | string | MTN refill profile identifier. Must be supplied/confirmed by MTN; do not invent. |
| `voucherActivationCode` | string | Voucher activation code for voucher-based refill; do not collect or log voucher secrets unnecessarily. |
| `targetSystem` | string | Target system value; obtain from MTN's partner configuration. |
| `serialNumber` | string | Voucher serial number where applicable. Do not fabricate. |
| `transactionAmount` | integer (int32) | Amount for the refill. **Units, minimum/maximum, and whether it applies to voucher-less flow must be confirmed with MTN. Do not assume rand, cents, or voucher face value.** |

### Request template (not a live-ready payload)

This is a structural example only. The placeholders are not valid MTN values and must be replaced only with values documented for Eyaelo's approved application.

```http
PATCH /v1/customers/{E123_MSISDN}/plans/refill HTTP/1.1
Host: api.mtn.com
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
transactionId: <UNIQUE_TRANSACTION_ID>
```

```json
{
  "refillType": "<MTN_APPROVED_REFILL_TYPE>",
  "refillProfileId": "<MTN_ASSIGNED_PROFILE_ID>",
  "targetSystem": "<MTN_APPROVED_TARGET_SYSTEM>",
  "transactionAmount": 0
}
```

Do not send this template to production. The example intentionally does not include a voucher activation code or serial number; MTN must confirm which fields are needed for the voucher-less use case.

## 3. Response schema published by MTN

The documented HTTP 200 response may contain:

| Field | Type |
|---|---|
| `statusCode` | string |
| `statusMessage` | string |
| `transactionId` | string |
| `sequenceNo` | string |
| `data.amount` | integer (int64) |
| `data.currencyCode` | string |
| `data.serialStatus` | string |
| `data.actionStatus` | string |
| `data.status` | string |
| `data.serialNumber` | string |
| `data.group` | string |
| `data.success` | boolean |
| `data.responseCode` | integer (int32) |
| `data.responseMessage` | string |
| `data.failureReason` | string |
| `data.addtionalInformation` | referenced MTN schema (MTN spells this property `addtionalInformation` in the published document) |

**Important:** HTTP 200 alone must not be treated as proof that the SIM was credited. The adapter must inspect the provider's documented business result fields and reconcile the transaction using MTN's transaction identifiers/status semantics. Do not assume that `data.success === true` is sufficient until MTN confirms finality and any asynchronous follow-up requirements.

## 4. Documented error responses

The published operation lists HTTP `400`, `401`, `403`, `404`, `500`, `502`, and `503`, with an API error body that can include `statusCode`, `statusMessage`, `supportMessage`, `transactionId`, `sequenceNo`, and `timestamp`.

- `400`: request validation/required fields problem. Do not retry unchanged.
- `401`: missing/invalid authentication. Refresh credentials securely; never expose them to the browser.
- `403`: app/product entitlement or permission may be missing. Do not try to bypass access controls.
- `404`: subscriber/resource/path may not be recognized.
- `500`, `502`, `503`: server/upstream/transient issue. A timeout or server error can leave the financial outcome unknown; **never blindly resubmit**.

## 5. OAuth and MTN app setup

The product page says this API uses a bearer token obtained through MTN MADAPI OAuth 2.0. MTN's developer portal describes registering an application, selecting regions and enabling products, then accessing keys after approval.

Before coding the live connector:
1. Sign in at [MTN Developer Portal](https://developers.mtn.com/).
2. Open or create Eyaelo's application.
3. Select **South Africa** and request/enable **Plans v2 / Customer Plans API v2**.
4. Confirm the application is approved for the production operation, not merely visible in the catalogue.
5. Use MTN's current OAuth guide for the exact token URL, client authentication method, scope/audience, expiry, and refresh behavior. Never guess token details from another MTN API.
6. Ask MTN to confirm the voucher-less refill's required fields, valid `refillType`, `refillProfileId`, `targetSystem`, transaction amount units/limits, E.123 MSISDN format for South Africa, and whether a transaction-status query/callback exists.
7. Keep client credentials and access tokens only in Cloudflare Worker secrets. Never store them in Git, browser code, the dashboard, screenshots, or chat.

Official onboarding guide: [MTN Developer Portal](https://developers.mtn.com/). General API conventions: [Things every developer should know](https://developers.mtn.com/getting-started/things-every-developer-should-know).

## 6. Eyaelo implementation contract

The current dashboard is a draft/test build. Keep live provider submission **disabled** until all approval and request semantics above are verified.

Proposed server-side secret names (names are Eyaelo conventions, not MTN-mandated names):
- `MTN_MADAPI_CLIENT_ID`
- `MTN_MADAPI_CLIENT_SECRET`
- `MTN_REFILL_ENABLED` (explicit deployment kill switch; default `false`)
- Optional, only if MTN supplies them: `MTN_REFILL_PROFILE_ID`, `MTN_REFILL_TARGET_SYSTEM`, `MTN_REFILL_TYPE`

The implementation must:
- expose no MTN secrets to the client;
- allow only the MTN South Africa network connector and valid E.123-format target MSISDNs;
- require an explicit admin confirmation showing number, network, amount, and that real airtime will be purchased;
- enforce an initially approved low transaction limit server-side (limit to be set only after MTN confirms allowed denominations);
- create a unique `transactionId` and internal idempotency record before sending;
- prevent duplicate submissions and never auto-retry an ambiguous financial transaction;
- record request metadata with sensitive voucher/token values redacted;
- distinguish `draft`, `submitting`, `confirmed`, `failed`, and `unknown/reconciliation-required` states;
- mark success only from MTN-confirmed final status, not from a local ledger update or HTTP status alone;
- provide a reconciliation path for timeouts and unknown results before another attempt;
- retain a complete audit trail without storing access tokens or unnecessary personal data.

## 7. Test and release sequence

1. Validate the adapter with mocked responses and schema checks only.
2. Use MTN's sandbox if this product offers one for the operation; do not assume that it does.
3. Confirm the approved production credentials and partner profile with MTN.
4. Deploy with `MTN_REFILL_ENABLED=false`; verify authentication and non-financial preflight checks first.
5. Enable a single low-value live test only after the owner explicitly approves the number and amount, the denomination is MTN-approved, and the account has sufficient authorised funding.
6. Confirm the actual subscriber balance/provider receipt independently and reconcile it to Eyaelo's ledger.
7. Leave live refill disabled if MTN has not confirmed the required request fields, transaction amount units, or final-status semantics.

## 8. Known unknowns — blockers for live recharge

The public OpenAPI document establishes the route, method, OAuth scheme, field names/types, and response shape. It does **not** establish all operational values required to safely submit a voucher-less South African top-up. The following must be verified from the approved app's Try Operation/portal configuration or MTN support:

- required fields and valid enumeration values;
- amount units and allowed denominations/limits;
- assigned refill profile and target system;
- exact OAuth client/token configuration and product scopes;
- production access/partner eligibility and funding arrangement;
- transaction finality, reconciliation/status operation, and retry rules.

**No real recharge is initiated by this document.**
