/**
 * Eyaelo internal voucher lab primitives.
 * These vouchers are not carrier-issued and cannot credit a real SIM.
 * Route wiring must remain admin-authenticated and disabled unless explicitly enabled.
 */
export interface VoucherLabEnv {
  DB: D1Database;
  VOUCHER_LAB_ENABLED?: string;
}

type VoucherRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: "issued" | "redeemed" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
};

const nowIso = (): string => new Date().toISOString();

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return encodeHex(new Uint8Array(digest));
}

function makeToken(): string {
  // 20 random bytes = 160 bits of entropy. Grouping improves manual transcription.
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = encodeHex(bytes);
  return `EYA-${hex.match(/.{1,5}/g)?.join("-") ?? hex}`;
}

function normaliseToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  if (!/^EYA-(?:[0-9A-F]{5}-){7}[0-9A-F]{5}$/.test(token)) return null;
  return token;
}

function assertLabEnabled(env: VoucherLabEnv): void {
  if (env.VOUCHER_LAB_ENABLED !== "true") {
    throw new Error("voucher_lab_disabled");
  }
}

/** Creates an internal-only test voucher. Display the returned token only once. */
export async function issueInternalTestVoucher(
  env: VoucherLabEnv,
  amountCents: number,
  expiresInHours = 24,
): Promise<{ id: string; token: string; amount_cents: number; currency: "ZAR"; status: "issued"; expires_at: string; label: string }> {
  assertLabEnabled(env);
  if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
    throw new Error("invalid_amount_cents");
  }
  if (!Number.isSafeInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
    throw new Error("invalid_expiry_hours");
  }

  const id = crypto.randomUUID();
  const token = makeToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO internal_test_vouchers (id, token_hash, amount_cents, currency, status, created_at, expires_at) VALUES (?, ?, ?, 'ZAR', 'issued', ?, ?)",
    ).bind(id, tokenHash, amountCents, createdAt, expiresAt),
    env.DB.prepare(
      "INSERT INTO internal_voucher_lab_events (id, voucher_id, event_type, outcome, event_at, details_json) VALUES (?, ?, 'voucher.issued', 'success', ?, ?)",
    ).bind(crypto.randomUUID(), id, createdAt, JSON.stringify({ amount_cents: amountCents, currency: "ZAR" })),
  ]);

  return {
    id,
    token,
    amount_cents: amountCents,
    currency: "ZAR",
    status: "issued",
    expires_at: expiresAt,
    label: "INTERNAL TEST CREDIT — NOT REAL OPERATOR AIRTIME",
  };
}

/** Validates and optionally redeems once. All redemption state changes are conditional/atomic. */
export async function validateInternalTestVoucher(
  env: VoucherLabEnv,
  suppliedToken: unknown,
  redeem = false,
  requestId?: string,
): Promise<
  | { valid: true; status: "issued"; id: string; amount_cents: number; currency: string; simulated: true; label: string }
  | { valid: true; status: "redeemed"; id: string; amount_cents: number; currency: string; simulated: true; label: string }
  | { valid: false; status: "invalid_format" | "unknown" | "expired" | "revoked" | "already_redeemed"; simulated: true; label: string }
> {
  assertLabEnabled(env);
  const label = "INTERNAL TEST CREDIT — NOT REAL OPERATOR AIRTIME";
  const token = normaliseToken(suppliedToken);
  const now = nowIso();

  if (!token) {
    await env.DB.prepare(
      "INSERT INTO internal_voucher_lab_events (id, event_type, outcome, event_at, request_id, details_json) VALUES (?, 'voucher.validate', 'invalid_format', ?, ?, '{}')",
    ).bind(crypto.randomUUID(), now, requestId ?? null).run();
    return { valid: false, status: "invalid_format", simulated: true, label };
  }

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT id, amount_cents, currency, status, created_at, expires_at, redeemed_at FROM internal_test_vouchers WHERE token_hash = ?",
  ).bind(tokenHash).first<VoucherRow>();

  if (!row) {
    await env.DB.prepare(
      "INSERT INTO internal_voucher_lab_events (id, event_type, outcome, event_at, request_id, details_json) VALUES (?, 'voucher.validate', 'unknown', ?, ?, '{}')",
    ).bind(crypto.randomUUID(), now, requestId ?? null).run();
    return { valid: false, status: "unknown", simulated: true, label };
  }

  if (row.status === "revoked") return { valid: false, status: "revoked", simulated: true, label };
  if (row.status === "redeemed") return { valid: false, status: "already_redeemed", simulated: true, label };

  if (row.status === "expired" || row.expires_at <= now) {
    await env.DB.batch([
      env.DB.prepare("UPDATE internal_test_vouchers SET status = 'expired' WHERE id = ? AND status = 'issued'").bind(row.id),
      env.DB.prepare(
        "INSERT INTO internal_voucher_lab_events (id, voucher_id, event_type, outcome, event_at, request_id, details_json) VALUES (?, ?, 'voucher.validate', 'expired', ?, ?, '{}')",
      ).bind(crypto.randomUUID(), row.id, now, requestId ?? null),
    ]);
    return { valid: false, status: "expired", simulated: true, label };
  }

  if (redeem) {
    const redeemedAt = nowIso();
    const reference = crypto.randomUUID();
    // D1 batch is transactional. The audit insert is conditional on this exact
    // redemption timestamp being written, so the voucher state and audit record
    // commit together or roll back together.
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE internal_test_vouchers SET status = 'redeemed', redeemed_at = ?, redemption_reference = ? WHERE id = ? AND status = 'issued' AND expires_at > ?",
      ).bind(redeemedAt, reference, row.id, redeemedAt),
      env.DB.prepare(
        "INSERT INTO internal_voucher_lab_events (id, voucher_id, event_type, outcome, event_at, request_id, details_json) SELECT ?, ?, 'voucher.redeem', 'success', ?, ?, ? WHERE EXISTS (SELECT 1 FROM internal_test_vouchers WHERE id = ? AND status = 'redeemed' AND redeemed_at = ? AND redemption_reference = ?)",
      ).bind(
        crypto.randomUUID(),
        row.id,
        redeemedAt,
        requestId ?? null,
        JSON.stringify({ amount_cents: row.amount_cents, currency: row.currency }),
        row.id,
        redeemedAt,
        reference,
      ),
    ]);
    const update = results[0];
    const audit = results[1];

    if (!update.success || update.meta.changes !== 1 || !audit.success || audit.meta.changes !== 1) {
      const latest = await env.DB.prepare("SELECT status, expires_at FROM internal_test_vouchers WHERE id = ?").bind(row.id).first<{ status: string; expires_at: string }>();
      const status = latest?.status === "expired" || (latest?.expires_at && latest.expires_at <= nowIso()) ? "expired" : "already_redeemed";
      return { valid: false, status, simulated: true, label };
    }

    return { valid: true, status: "redeemed", id: row.id, amount_cents: row.amount_cents, currency: row.currency, simulated: true, label };
  }

  await env.DB.prepare(
    "INSERT INTO internal_voucher_lab_events (id, voucher_id, event_type, outcome, event_at, request_id, details_json) VALUES (?, ?, 'voucher.validate', 'valid', ?, ?, '{}')",
  ).bind(crypto.randomUUID(), row.id, now, requestId ?? null).run();

  return { valid: true, status: "issued", id: row.id, amount_cents: row.amount_cents, currency: row.currency, simulated: true, label };
}
