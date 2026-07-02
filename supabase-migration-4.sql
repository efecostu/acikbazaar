-- ============================================================
-- AçıkBazaar — Migration 4: Kullanıcı market önerileri
-- Supabase SQL Editor'da çalıştır
-- ============================================================

CREATE TABLE IF NOT EXISTS market_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title_tr TEXT NOT NULL CHECK (char_length(title_tr) BETWEEN 10 AND 140),
  category TEXT NOT NULL CHECK (category IN ('politics','economy','sports','tech','world','entertainment','weather')),
  ends_at DATE NOT NULL,
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suggestions_status_idx ON market_suggestions(status, created_at DESC);

ALTER TABLE market_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suggestions_insert_own" ON market_suggestions;
DROP POLICY IF EXISTS "suggestions_select_own" ON market_suggestions;

CREATE POLICY "suggestions_insert_own" ON market_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suggestions_select_own" ON market_suggestions
  FOR SELECT USING (auth.uid() = user_id);

-- Spam önlemi: kullanıcı başına günde en fazla 5 öneri
CREATE OR REPLACE FUNCTION check_suggestion_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM market_suggestions
      WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'rate_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS suggestion_rate_limit ON market_suggestions;
CREATE TRIGGER suggestion_rate_limit
  BEFORE INSERT ON market_suggestions
  FOR EACH ROW EXECUTE FUNCTION check_suggestion_rate_limit();
