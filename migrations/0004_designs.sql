-- Metadata for submitted architectural designs. Binary image/file storage will be connected later through R2.
CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Residential','Commercial','Education','Healthcare','Infrastructure','Other projects')),
  designer_name TEXT NOT NULL DEFAULT '',
  designer_email TEXT NOT NULL DEFAULT '',
  designer_phone TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price_label TEXT NOT NULL DEFAULT 'Enquire for price',
  rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (rights_confirmed IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_designs_status_category ON designs(status, category, id DESC);
