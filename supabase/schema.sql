-- Categories table
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  description TEXT NOT NULL
);

-- Tools table
CREATE TABLE tools (
  id             TEXT          PRIMARY KEY,
  name           TEXT          NOT NULL,
  slug           TEXT          NOT NULL UNIQUE,
  tagline        TEXT          NOT NULL,
  description    TEXT          NOT NULL,
  logo           TEXT          NOT NULL,
  url            TEXT          NOT NULL,
  affiliate_url  TEXT,
  category       TEXT          NOT NULL REFERENCES categories(id),
  tags           TEXT[]        NOT NULL DEFAULT '{}',
  pricing        TEXT          NOT NULL CHECK (pricing IN ('free','freemium','paid')),
  indian_pricing TEXT,
  rating         NUMERIC(2,1)  NOT NULL CHECK (rating >= 0.0 AND rating <= 5.0),
  review_count   INTEGER,
  best_for_india BOOLEAN       NOT NULL DEFAULT false,
  free_forever   BOOLEAN       NOT NULL DEFAULT false,
  featured       BOOLEAN       NOT NULL DEFAULT false,
  languages      TEXT[]                 DEFAULT '{}',
  pros           TEXT[]        NOT NULL DEFAULT '{}',
  cons           TEXT[]        NOT NULL DEFAULT '{}',
  date_added     DATE          NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Agent-ready columns (unused by site now; required by future automation agent)
  source         TEXT          NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','agent','import')),
  last_synced_at TIMESTAMPTZ,
  needs_review   BOOLEAN       NOT NULL DEFAULT false,
  agent_notes    TEXT
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security — allow anon read (needed for build-time fetch with anon key)
ALTER TABLE tools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on tools"
  ON tools FOR SELECT USING (true);

CREATE POLICY "Public read on categories"
  ON categories FOR SELECT USING (true);
