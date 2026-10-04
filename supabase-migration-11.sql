-- ============================================================
-- MIGRATION 11: VPS ajan katmanı (worker/)
--   agent_runs        her ajan çalışmasının kaydı (admin /admin/agents'ta görünür)
--   market_estimates  tracker ajanının haber tabanlı olasılık tahminleri (trader botlar kullanır)
--   agent_settings    kill switch / ajan bazlı duraklatma (SSH'sız kontrol)
-- Hepsi yalnızca service_role: RLS açık, policy yok.
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id          BIGSERIAL PRIMARY KEY,
  agent       TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  ok          BOOLEAN,
  summary     JSONB,
  error       TEXT
);
CREATE INDEX IF NOT EXISTS agent_runs_agent_started_idx ON agent_runs(agent, started_at DESC);
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS market_estimates (
  id          BIGSERIAL PRIMARY KEY,
  market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  yes_prob    NUMERIC(4,3) NOT NULL CHECK (yes_prob >= 0 AND yes_prob <= 1),
  confidence  NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  summary_tr  TEXT,
  decided     BOOLEAN NOT NULL DEFAULT FALSE,
  sources     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS market_estimates_market_created_idx ON market_estimates(market_id, created_at DESC);
ALTER TABLE market_estimates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS agent_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;

-- enabled=false → tüm ajanlar durur; paused: ["trader", ...] → sadece onlar durur
INSERT INTO agent_settings (key, value) VALUES
  ('enabled', 'true'::jsonb),
  ('paused',  '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 90 günden eski çalışma kayıtlarını ve tahminleri temizlemek için (ops ajanı çağırır)
CREATE OR REPLACE FUNCTION public.prune_agent_data()
RETURNS VOID AS $$
  DELETE FROM agent_runs WHERE started_at < NOW() - INTERVAL '90 days';
  DELETE FROM market_estimates WHERE created_at < NOW() - INTERVAL '90 days';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.prune_agent_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_agent_data() TO service_role;
