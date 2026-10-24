-- Internal Eyaelo test credits only; not operator-issued airtime.
CREATE TABLE IF NOT EXISTS internal_test_vouchers (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 amount_cents INTEGER NOT NULL CHECK (amount_cents >= 100 AND amount_cents <= 100000),
 currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency='ZAR'),
 status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed','expired','revoked')),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 redeemed_at TEXT,
 redemption_reference TEXT UNIQUE,
 created_by TEXT NOT NULL DEFAULT 'admin-token'
);
CREATE INDEX IF NOT EXISTS idx_voucher_status_expiry ON internal_test_vouchers(status,expires_at);
CREATE TABLE IF NOT EXISTS internal_voucher_lab_events (
 id TEXT PRIMARY KEY,
 voucher_id TEXT,
 event_type TEXT NOT NULL,
 outcome TEXT NOT NULL,
 event_at TEXT NOT NULL,
 request_id TEXT,
 details_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_voucher_events_voucher_time ON internal_voucher_lab_events(voucher_id,event_at);
