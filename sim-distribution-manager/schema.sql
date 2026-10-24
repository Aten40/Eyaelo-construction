-- Eyaelo SIM Distribution Manager — Cloudflare D1 schema
-- Apply only to a dedicated SIM-manager D1 database, never the website database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sim_cards (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  assigned_agent TEXT,
  assigned_location TEXT,
  registration_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','lost','closed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sim_cards_network ON sim_cards(network);
CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status);
CREATE INDEX IF NOT EXISTS idx_sim_cards_agent ON sim_cards(assigned_agent);

CREATE TABLE IF NOT EXISTS recharge_transactions (
  id TEXT PRIMARY KEY,
  sim_card_id TEXT NOT NULL REFERENCES sim_cards(id),
  phone_number_snapshot TEXT NOT NULL,
  network_snapshot TEXT NOT NULL CHECK (network_snapshot IN ('MTN','Vodacom','Cell C','Telkom')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','submitted','confirmed','failed','unknown','cancelled')),
  provider TEXT,
  provider_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_by TEXT NOT NULL,
  request_source TEXT NOT NULL DEFAULT 'admin' CHECK (request_source IN ('admin','system','demo')),
  provider_response_code TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_recharges_card_created ON recharge_transactions(sim_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharges_status_created ON recharge_transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharges_provider_ref ON recharge_transactions(provider, provider_reference);
-- Internal simulated balances only. These tables do not represent carrier balances.
CREATE TABLE IF NOT EXISTS simulated_subscriber_balances (
  phone_number TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (phone_number, network)
);

CREATE TABLE IF NOT EXISTS simulated_recharge_ledger (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status = 'simulated'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);


-- TMF654-shaped subset test ledger. This records internal simulation only.
CREATE TABLE IF NOT EXISTS charging_balance_adjustments (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  external_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status = 'simulated'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_charging_adjustments_phone_created
  ON charging_balance_adjustments(phone_number, created_at DESC);

-- Verified network usage/activity is separate from top-up transactions.
CREATE TABLE IF NOT EXISTS network_activity (
  id TEXT PRIMARY KEY,
  sim_card_id TEXT NOT NULL REFERENCES sim_cards(id),
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  activity_type TEXT NOT NULL,
  quantity INTEGER,
  quantity_unit TEXT,
  source TEXT NOT NULL CHECK (source IN ('provider_api','network_statement','manual_verified')),
  source_reference TEXT,
  occurred_at TEXT NOT NULL,
  verified_by TEXT NOT NULL,
  verification_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(source, source_reference)
);

CREATE INDEX IF NOT EXISTS idx_activity_card_time ON network_activity(sim_card_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS commission_statements (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('MTN','Vodacom','Cell C','Telkom')),
  statement_period_start TEXT NOT NULL,
  statement_period_end TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status TEXT NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','reconciled','disputed','paid')),
  source_reference TEXT,
  imported_by TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (statement_period_end >= statement_period_start),
  UNIQUE(network, statement_period_start, statement_period_end, source_reference)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','denied','failure')),
  details_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id, created_at DESC);
