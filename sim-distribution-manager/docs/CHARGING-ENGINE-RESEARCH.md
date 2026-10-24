# Eyaelo SIM Distribution Manager — Charging Engine Research

Date: 2026-10-24
Status: Research/design only. No production deployment or live-network recharge is enabled.

## Objective

Build Eyaelo-owned software for recharge transaction handling and charging logic, then determine the technical integration required for real prepaid airtime/data balances on MTN, Vodacom, Cell C and Telkom. Keep this work separate from the Eyaelo Construction website and its Worker.

## Findings

### 1. 3GPP architecture

3GPP TS 32.296 defines an Online Charging System (OCS), including the Account Balance Management Function (ABMF). Its architecture describes the Rr reference point between the ABMF and an external recharging server.

Important limitation: this architecture reference does not, by itself, provide a universal public production endpoint or prove that each South African operator exposes the same interface. We must identify the actual deployed system and supported protocol for each network.

References:
- 3GPP TS 32.296: https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=1913
- iTecSpec architecture section: https://itecspec.com/3gpp/32.296/s/5.1
- ETSI TS 132 296 Release 18: https://standards.iteh.ai/catalog/standards/etsi/aa59ab78-f5d8-4d48-8a22-3732e1b1322a/etsi-ts-132-296-v18-0-0-2024-05

### 2. Candidate open-source charging systems

#### SigScale OCS
Repository: https://github.com/sigscale/ocs
Licence: Apache-2.0 (verify notices and dependencies before distribution).
Capabilities documented by the project include prepaid real-time charging, product/subscriber provisioning, account-balance management, TM Forum REST APIs, and Diameter/RADIUS interfaces. It is the first candidate to study because its licence is comparatively permissive for commercial product development.

Its TM Forum Prepay Balance API (TMF654) can create/update balances in the SigScale OCS instance itself. This is a useful way to prove our recharge logic against a test charging system. It does NOT mean the same API can credit MTN/Vodacom/Cell C/Telkom accounts unless those operators expose a compatible endpoint and grant the relevant integration.

References:
- Source and interfaces: https://github.com/sigscale/ocs
- SigScale API list and balance model: https://sigscale.atlassian.net/wiki/spaces/SO/pages/3833857/FAQ+on+OCS
- SigScale top-up API example: https://sigscale.atlassian.net/wiki/spaces/SO/pages/3833890/How-To+with+OCS
- TM Forum TMF654 API: https://www.tmforum.org/open-digital-architecture/open-apis/prepay-balance-management-api-TMF654/v4.0

#### CGRateS
Repository: https://github.com/cgrates/cgrates
Licence: AGPL-3.0-or-later in current source. Review network-use/source-sharing obligations and dependencies before using it in a commercial hosted service.
Capabilities include real-time/offline charging, rating, balance/bundle management, event/session charging, fraud controls and APIs.

References:
- Source: https://github.com/cgrates/cgrates
- Architecture: https://cgrates.readthedocs.io/en/latest/architecture.html
- Release/licence history: https://github.com/cgrates/cgrates/releases

## Initial comparison

| Requirement | SigScale OCS | CGRateS | Eyaelo decision |
|---|---|---|---|
| Prepaid balance ledger | Yes | Yes | Required |
| Rating/bundles | Yes | Yes | Required for data bundles and tariffs |
| REST/API integration | TM Forum APIs and other documented APIs | Multiple RPC/API integrations | Required |
| Telecom protocols | Includes Diameter and RADIUS interfaces | Protocol integration depends on agents/connectors and deployment | Research by operator |
| Commercial licence review | Apache-2.0; still review notices/dependencies | AGPL-3.0-or-later; extra obligations may apply | Prefer permissive components if practical |
| Automatic access to carrier balances | Not established by public documentation | Not established by public documentation | Must not assume |

## Proposed Eyaelo architecture

1. **Transaction API:** accepts network, MSISDN, amount/product, unique client reference and idempotency key.
2. **Payment/ledger layer:** records payment and recharge states separately; immutable transaction history.
3. **Charging engine:** validates product, price, amount, customer eligibility and balance changes.
4. **Network adapters:** separate MTN, Vodacom, Cell C and Telkom modules, enabled only when the actual interface is known and testable.
5. **Simulator:** local/mock operator endpoint for automated tests; never label simulated credit as real carrier airtime.
6. **Reconciliation:** compare submitted requests, operator responses, reversals and settlement records.
7. **Security:** TLS, scoped credentials, secret storage, request signing/token validation as required by each interface, rate limits, audit logs and credential rotation.
8. **Admin dashboard:** pending/success/failed/unknown states, with no duplicate submission on retry.

Suggested transaction states: created -> payment_confirmed -> queued -> submitted -> confirmed | failed | unknown -> reconciled. An 'unknown' result must be checked before retrying to prevent double recharge.

## Prototype plan

### Phase A — no-cost research and sandbox
- Read SigScale OCS setup documentation and TMF654 API schema.
- Run the OCS in a development environment when compute is available; do not deploy the full Erlang-based OCS to a Cloudflare Worker.
- Create a test subscriber and test balance.
- Send a test balance adjustment through TMF654 and confirm the resulting balance.
- Add negative tests: wrong credentials, invalid product, duplicate request, timeout and retry, insufficient funds, and failed adjustment.
- Keep the existing Eyaelo Worker in sandbox mode; no real airtime submission.

### Phase B — Eyaelo adapter layer
- Define a common interface such as `submitRecharge(network, msisdn, amount, reference)`.
- Implement a mock adapter first.
- Store operator-specific endpoint and authentication configuration separately from source code.
- Require an explicit per-network enable flag before any live adapter can be used.

### Phase C — real network integration research
For each operator, determine:
- the actual charging/CRM/OSS system vendor, where publicly known;
- the documented external recharge interface and protocol;
- whether the interface supports crediting prepaid voice balance and/or data bundles;
- required client authentication, credentials, certificates, IP allowlists or private connectivity;
- test/sandbox availability, settlement/reconciliation model, rate limits and error semantics.

Do not infer a private endpoint, token, secret key or permission from a public standard. Do not claim a test OCS balance is carrier airtime.

## Acceptance criteria

- Test recharge updates only the simulated subscriber balance.
- Every request has a unique reference and an idempotency key.
- A repeated request cannot credit twice.
- Failures and unknown outcomes are visible and auditable.
- The test UI clearly labels simulated results.
- Live network adapters remain disabled until a documented interface is identified and tested.

## Current conclusion

We can build and own the platform's transaction, ledger, charging and adapter software. SigScale OCS is the first test candidate due to its documented functionality and Apache-2.0 licence. Public specifications confirm the general OCS/external-recharge-server architecture, but available research has not established a universal public recharge endpoint for South African operators. The next technical milestone is a simulated end-to-end recharge using TMF654, followed by operator-specific interface research.


## Eyaelo implementation step — TMF654-shaped internal charging API

Eyaelo's SIM Manager now includes an authenticated, deliberately limited API subset for internal balance adjustment and bucket lookup. Routes:
- `POST /tmf-api/prepayBalanceManagement/v4/balanceAdjustment`
- `GET /tmf-api/prepayBalanceManagement/v4/bucket?product.id=PHONE&network=NETWORK`

This is intended to exercise the request/response contract and transaction discipline before building a network adapter. It is not full TMF654 conformance, and it is not connected to SigScale OCS or any carrier. The API mutates only Eyaelo's simulated D1 balance ledger. Responses explicitly report simulation-only status and no real carrier credit. See `SIMULATED-RECHARGE-TEST.md` for payloads and manual test steps.

The next technical gate is deployment and manual dashboard/API validation, then a separate development instance of an actual OCS such as SigScale for broader standards compatibility testing. Do not point this prototype at live subscriber balances.
