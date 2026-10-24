# Eyaelo Internal Voucher Lab

**Lab ledger only, not a carrier airtime system.** Tokens created here are not issued or recognised by MTN, Vodacom, Cell C, Telkom, or another operator. Redeeming one changes only Eyaelo's dedicated test ledger and cannot add airtime to a SIM.

## Isolation and controls
- Separate Worker directory and dedicated D1 database; no airtime provider SDK or provider credentials.
- All /api/vouchers/* routes require Authorization: Bearer <ADMIN_API_TOKEN>.
- Voucher routes return disabled/not-found unless VOUCHER_LAB_ENABLED=true.
- wrangler.toml contains a placeholder database ID and must not be deployed as-is.
- Raw token is returned only at issuance. Only its SHA-256 hash is stored; raw token is never logged.
- Redemption and success audit use a conditional state change in a D1 batch.
- No automated USSD, voucher guessing, carrier impersonation, or validation bypass.

## Endpoints (only after configuration and review)
- POST /api/vouchers/issue JSON: {"amount_cents":500,"expires_in_hours":24}. Amount R1–R1,000; expiry 1–720 hours.
- POST /api/vouchers/validate JSON: {"token":"EYA-...","redeem":false}. Use redeem:true to consume once.
- GET /health reports service status and liveCarrierCredit:false.

## Before deployment
1. Review code and install dependencies.
2. Run `npm run check` and `npm test`.
3. Current automated tests cover token format, token normalization/rejection, deterministic hashing, repeated-sample uniqueness, and bearer-token authentication. They are not end-to-end database tests.
4. Add integration tests against disposable D1 for issuance, unknown/altered/expired/revoked tokens, duplicate redemption, and concurrent redemption.
5. Configure a dedicated D1 database and a strong random Worker secret; do not reuse SIM Manager credentials.
6. Keep `VOUCHER_LAB_ENABLED=false` until checks and review pass.
7. Confirm official carrier recharge separately. Never treat generated lab tokens as operator-issued vouchers.
