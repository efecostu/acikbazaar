-- ============================================================
-- AçıkBazaar — Migration 3: Yorumlar + Bot altyapısı
-- Supabase SQL Editor'da çalıştır (migration-2'den SONRA)
-- ============================================================

-- 1. Yorumlar tablosu
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_market_idx ON comments(market_id, created_at DESC);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;

CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = user_id);

-- 2. Bot işareti (UI'da "BOT" rozeti için)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;

UPDATE profiles SET is_bot = true
WHERE username IN ('KahinKemal', 'BorsaKurdu', 'AnalizciAyse', 'SkeptikSelin');

-- 3. Botları leaderboard'dan çıkar
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.username,
  p.balance,
  p.total_bets,
  p.total_won,
  COALESCE(SUM(CASE WHEN b.status='won' THEN b.potential_payout - b.amount ELSE -b.amount END), 0) AS profit,
  CASE WHEN p.total_bets > 0 THEN ROUND(p.total_won::numeric / p.total_bets * 100) ELSE 0 END AS win_rate
FROM profiles p
LEFT JOIN bets b ON b.user_id = p.id AND b.status != 'pending'
WHERE COALESCE(p.is_bot, false) = false
GROUP BY p.id, p.username, p.balance, p.total_bets, p.total_won
ORDER BY profit DESC;
