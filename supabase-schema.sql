-- ============================================================
-- AçıkBazaar — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  balance INTEGER DEFAULT 1000,
  total_bets INTEGER DEFAULT 0,
  total_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Markets
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_tr TEXT NOT NULL,
  description_en TEXT,
  description_tr TEXT,
  category TEXT CHECK (category IN ('politics','economy','sports','tech','world')),
  region TEXT CHECK (region IN ('turkey','global')),
  yes_prob FLOAT DEFAULT 0.5,
  yes_pool INTEGER DEFAULT 0,
  no_pool INTEGER DEFAULT 0,
  total_volume INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','closed','resolved')),
  outcome BOOLEAN,
  ends_at TIMESTAMPTZ NOT NULL,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bets
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  side TEXT CHECK (side IN ('yes','no')),
  amount INTEGER NOT NULL,
  odds_at_bet FLOAT NOT NULL,
  potential_payout INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','won','lost')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard view
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
GROUP BY p.id, p.username, p.balance, p.total_bets, p.total_won
ORDER BY profit DESC;

-- Credit + win count update (called on bet settlement)
CREATE OR REPLACE FUNCTION credit_and_update_user(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    balance = balance + p_amount,
    total_won = total_won + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment market pool when a bet is placed
CREATE OR REPLACE FUNCTION increment_market_pool(
  p_market_id UUID,
  p_side TEXT,
  p_amount INTEGER
)
RETURNS void AS $$
BEGIN
  IF p_side = 'yes' THEN
    UPDATE markets
    SET
      yes_pool = yes_pool + p_amount,
      yes_prob = (yes_pool + p_amount)::float / NULLIF(yes_pool + no_pool + p_amount, 0),
      total_volume = total_volume + p_amount,
      participant_count = participant_count + 1
    WHERE id = p_market_id;
  ELSE
    UPDATE markets
    SET
      no_pool = no_pool + p_amount,
      yes_prob = yes_pool::float / NULLIF(yes_pool + no_pool + p_amount, 0),
      total_volume = total_volume + p_amount,
      participant_count = participant_count + 1
    WHERE id = p_market_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment total_bets on profile when a bet is placed
CREATE OR REPLACE FUNCTION increment_user_bet_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET total_bets = total_bets + 1 WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update only own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Markets: all can read, only service role can insert/update
CREATE POLICY "markets_select" ON markets FOR SELECT USING (true);
CREATE POLICY "markets_insert" ON markets FOR INSERT WITH CHECK (true); -- restrict in prod
CREATE POLICY "markets_update" ON markets FOR UPDATE USING (true);      -- restrict in prod

-- Bets: authenticated users can insert own bets, read own bets
CREATE POLICY "bets_select_own" ON bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bets_insert_own" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seed data (sample markets to get started)
-- ============================================================

INSERT INTO markets (title_en, title_tr, description_en, description_tr, category, region, yes_prob, yes_pool, no_pool, total_volume, participant_count, ends_at, tag)
VALUES
  (
    'Will USD/TRY exceed 40 before October 2025?',
    'USD/TRY Ekim 2025''den önce 40''ı geçer mi?',
    'Tracking the Turkish lira against the US dollar. Based on TCMB official rates.',
    'Türk lirası / Amerikan doları paritesi TCMB resmi kur verilerine göre takip edilmektedir.',
    'economy', 'turkey', 0.62, 620, 380, 1000, 14,
    NOW() + INTERVAL '4 months', 'hot'
  ),
  (
    'Will Galatasaray win the 2024-25 Süper Lig title?',
    'Galatasaray 2024-25 Süper Lig''i şampiyon olarak tamamlar mı?',
    'Galatasaray is the defending champion. Final standings determine the outcome.',
    'Galatasaray mevcut şampiyondur. Sezon sonu puan tablosu esas alınır.',
    'sports', 'turkey', 0.74, 1480, 520, 2000, 38,
    NOW() + INTERVAL '2 months', 'trending'
  ),
  (
    'Will the Fed cut rates at least once before December 2025?',
    'Fed, Aralık 2025''ten önce en az bir faiz indirimi yapar mı?',
    'Based on FOMC meeting decisions. A 25bps cut counts as YES.',
    'FOMC toplantı kararlarına göre. 25 baz puanlık indirim YES sayılır.',
    'economy', 'global', 0.55, 550, 450, 1000, 22,
    NOW() + INTERVAL '6 months', NULL
  ),
  (
    'Will Bitcoin reach $120k before 2026?',
    'Bitcoin 2026 öncesinde 120.000$''a ulaşır mı?',
    'Spot BTC price on major exchanges. Based on CoinGecko 24h average.',
    'Büyük borsalardaki spot BTC fiyatı. CoinGecko 24 saatlik ortalaması esas alınır.',
    'tech', 'global', 0.48, 960, 1040, 2000, 41,
    NOW() + INTERVAL '5 months', 'hot'
  ),
  (
    'Will a new Turkish unicorn emerge in 2025?',
    '2025 yılında yeni bir Türk unicorn''u ortaya çıkar mı?',
    'A Turkish-founded startup reaching $1B+ valuation in 2025.',
    '2025 yılında 1 milyar dolar veya üzeri değerlemeye ulaşan Türkiye kökenli startup.',
    'tech', 'turkey', 0.35, 350, 650, 1000, 17,
    NOW() + INTERVAL '6 months', NULL
  );
