CREATE TABLE IF NOT EXISTS stress_tests (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL,
  market TEXT NOT NULL,
  data_kind TEXT NOT NULL CHECK (data_kind IN ('LIVE', 'INDEXED', 'CACHED', 'HISTORICAL', 'DEMO', 'SIMULATED')),
  data_source TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stress_tests_created_at_idx ON stress_tests (created_at DESC);

CREATE TABLE IF NOT EXISTS replay_archives (
  id TEXT PRIMARY KEY,
  episode JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS replay_archives_created_at_idx ON replay_archives (created_at DESC);
