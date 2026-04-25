PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS table_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  table_id INTEGER NOT NULL,
  pot_amount INTEGER NOT NULL DEFAULT 0 CHECK (pot_amount >= 0),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables(id)
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  wallet_chips INTEGER NOT NULL DEFAULT 0 CHECK (wallet_chips >= 0),
  is_seated INTEGER NOT NULL DEFAULT 1 CHECK (is_seated IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables(id),
  UNIQUE (table_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  player_id INTEGER,
  action_type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_players_table_seated ON players (table_id, is_seated);
CREATE INDEX IF NOT EXISTS idx_logs_table_created ON action_logs (table_id, created_at DESC);
