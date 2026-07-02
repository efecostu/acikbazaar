-- ============================================================
-- AçıkBazaar — Migration 5: 100K kredi, streak, grafik geçmişi,
-- onboarding, çoklu-seçenekli marketler, botlar leaderboard'da
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Başlangıç kredisi 100.000 — mevcut herkese fark eklenir
ALTER TABLE profiles ALTER COLUMN balance SET DEFAULT 100000;
UPDATE profiles SET balance = balance + 99000;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    100000
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Streak + onboarding kolonları
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_bet_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Onboarding: kullanıcı kendi ilgi alanlarını set eder (dar yetkili RPC)
CREATE OR REPLACE FUNCTION set_interests(p_interests TEXT[])
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  UPDATE profiles SET interests = p_interests WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION set_interests(TEXT[]) TO authenticated;

-- 3. Olasılık geçmişi (grafik için) — her bahiste bir nokta
CREATE TABLE IF NOT EXISTS market_prob_history (
  id BIGSERIAL PRIMARY KEY,
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  yes_prob FLOAT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS prob_history_market_idx ON market_prob_history(market_id, recorded_at);
ALTER TABLE market_prob_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prob_history_select" ON market_prob_history;
CREATE POLICY "prob_history_select" ON market_prob_history FOR SELECT USING (true);

-- 4. Çoklu-seçenekli marketler
ALTER TABLE markets ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'binary';
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_kind_check;
ALTER TABLE markets ADD CONSTRAINT markets_kind_check CHECK (kind IN ('binary','multi'));
ALTER TABLE markets ADD COLUMN IF NOT EXISTS winning_option_id UUID;
UPDATE markets SET kind = 'binary' WHERE kind IS NULL;

CREATE TABLE IF NOT EXISTS market_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  label_tr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  pool INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS options_market_idx ON market_options(market_id, sort);
ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "options_select" ON market_options;
CREATE POLICY "options_select" ON market_options FOR SELECT USING (true);

ALTER TABLE bets ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES market_options(id) ON DELETE CASCADE;

-- 5. Streak yardımcısı: günün ilk bahsinde bonus, ardışık gün zinciri
CREATE OR REPLACE FUNCTION apply_streak(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_last DATE;
  v_streak INTEGER;
  v_bonus INTEGER := 0;
BEGIN
  SELECT last_bet_date, streak_count INTO v_last, v_streak FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_last = CURRENT_DATE THEN
    RETURN json_build_object('streak', COALESCE(v_streak, 0), 'bonus', 0);
  ELSIF v_last = CURRENT_DATE - 1 THEN
    v_streak := COALESCE(v_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;
  v_bonus := CASE
    WHEN v_streak >= 5 THEN 5000
    WHEN v_streak = 4 THEN 3000
    WHEN v_streak = 3 THEN 2000
    WHEN v_streak = 2 THEN 1000
    ELSE 500
  END;
  UPDATE profiles
  SET streak_count = v_streak, last_bet_date = CURRENT_DATE, balance = balance + v_bonus
  WHERE id = p_user_id;
  RETURN json_build_object('streak', v_streak, 'bonus', v_bonus);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. place_bet güncellendi: streak + olasılık geçmişi kaydı
CREATE OR REPLACE FUNCTION place_bet(p_market_id UUID, p_side TEXT, p_amount INTEGER)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_yes_pool INTEGER;
  v_no_pool INTEGER;
  v_status TEXT;
  v_kind TEXT;
  v_ends_at TIMESTAMPTZ;
  v_total INTEGER;
  v_prob FLOAT;
  v_odds FLOAT;
  v_payout INTEGER;
  v_new_yes_prob FLOAT;
  v_streak JSON;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_side NOT IN ('yes','no') THEN RAISE EXCEPTION 'invalid_side'; END IF;

  SELECT status, kind, ends_at, yes_pool, no_pool
  INTO v_status, v_kind, v_ends_at, v_yes_pool, v_no_pool
  FROM markets WHERE id = p_market_id FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'market_not_found'; END IF;
  IF v_kind <> 'binary' THEN RAISE EXCEPTION 'wrong_market_kind'; END IF;
  IF v_status <> 'active' OR v_ends_at < NOW() THEN RAISE EXCEPTION 'market_closed'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  v_total := v_yes_pool + v_no_pool;
  IF v_total = 0 THEN
    v_prob := 0.5;
  ELSIF p_side = 'yes' THEN
    v_prob := GREATEST(0.02, LEAST(0.98, (v_yes_pool::float / v_total) * 0.97));
  ELSE
    v_prob := GREATEST(0.02, LEAST(0.98, (v_no_pool::float / v_total) * 0.97));
  END IF;
  v_odds := ROUND((1.0 / v_prob)::numeric, 2);
  v_payout := FLOOR(p_amount / v_prob);

  UPDATE profiles SET balance = balance - p_amount, total_bets = total_bets + 1 WHERE id = v_user_id;

  IF p_side = 'yes' THEN
    v_new_yes_prob := (v_yes_pool + p_amount)::float / (v_total + p_amount);
    UPDATE markets SET yes_pool = yes_pool + p_amount, yes_prob = v_new_yes_prob,
      total_volume = total_volume + p_amount, participant_count = participant_count + 1
    WHERE id = p_market_id;
  ELSE
    v_new_yes_prob := v_yes_pool::float / (v_total + p_amount);
    UPDATE markets SET no_pool = no_pool + p_amount, yes_prob = v_new_yes_prob,
      total_volume = total_volume + p_amount, participant_count = participant_count + 1
    WHERE id = p_market_id;
  END IF;

  INSERT INTO bets (user_id, market_id, side, amount, odds_at_bet, potential_payout, status)
  VALUES (v_user_id, p_market_id, p_side, p_amount, v_odds, v_payout, 'pending');

  INSERT INTO market_prob_history (market_id, yes_prob) VALUES (p_market_id, v_new_yes_prob);

  v_streak := apply_streak(v_user_id);

  RETURN json_build_object(
    'new_balance', v_balance - p_amount + (v_streak->>'bonus')::int,
    'odds', v_odds,
    'potential_payout', v_payout,
    'streak', (v_streak->>'streak')::int,
    'streak_bonus', (v_streak->>'bonus')::int
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION place_bet(UUID, TEXT, INTEGER) TO authenticated;

-- 7. Çoklu-seçenek bahsi
CREATE OR REPLACE FUNCTION place_bet_option(p_market_id UUID, p_option_id UUID, p_amount INTEGER)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_status TEXT;
  v_kind TEXT;
  v_ends_at TIMESTAMPTZ;
  v_option_pool INTEGER;
  v_total INTEGER;
  v_count INTEGER;
  v_prob FLOAT;
  v_odds FLOAT;
  v_payout INTEGER;
  v_streak JSON;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT status, kind, ends_at INTO v_status, v_kind, v_ends_at
  FROM markets WHERE id = p_market_id FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'market_not_found'; END IF;
  IF v_kind <> 'multi' THEN RAISE EXCEPTION 'wrong_market_kind'; END IF;
  IF v_status <> 'active' OR v_ends_at < NOW() THEN RAISE EXCEPTION 'market_closed'; END IF;

  SELECT pool INTO v_option_pool FROM market_options
  WHERE id = p_option_id AND market_id = p_market_id FOR UPDATE;
  IF v_option_pool IS NULL THEN RAISE EXCEPTION 'option_not_found'; END IF;

  SELECT COALESCE(SUM(pool), 0), COUNT(*) INTO v_total, v_count
  FROM market_options WHERE market_id = p_market_id;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  IF v_total = 0 THEN
    v_prob := 1.0 / GREATEST(v_count, 2);
  ELSE
    v_prob := GREATEST(0.02, LEAST(0.98, (v_option_pool::float / v_total) * 0.97));
  END IF;
  v_odds := ROUND((1.0 / v_prob)::numeric, 2);
  v_payout := FLOOR(p_amount / v_prob);

  UPDATE profiles SET balance = balance - p_amount, total_bets = total_bets + 1 WHERE id = v_user_id;
  UPDATE market_options SET pool = pool + p_amount WHERE id = p_option_id;
  UPDATE markets SET total_volume = total_volume + p_amount, participant_count = participant_count + 1
  WHERE id = p_market_id;

  INSERT INTO bets (user_id, market_id, side, option_id, amount, odds_at_bet, potential_payout, status)
  VALUES (v_user_id, p_market_id, NULL, p_option_id, p_amount, v_odds, v_payout, 'pending');

  v_streak := apply_streak(v_user_id);

  RETURN json_build_object(
    'new_balance', v_balance - p_amount + (v_streak->>'bonus')::int,
    'odds', v_odds,
    'potential_payout', v_payout,
    'streak', (v_streak->>'streak')::int,
    'streak_bonus', (v_streak->>'bonus')::int
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION place_bet_option(UUID, UUID, INTEGER) TO authenticated;

-- 8. Botlar leaderboard'a geri döner (BOT rozeti için is_bot kolonu da gelir)
-- Kolon eklendiği için view önce düşürülmeli (CREATE OR REPLACE kolon ekleyemez)
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
SELECT
  p.username,
  p.is_bot,
  p.balance,
  p.total_bets,
  p.total_won,
  COALESCE(SUM(CASE WHEN b.status='won' THEN b.potential_payout - b.amount ELSE -b.amount END), 0) AS profit,
  CASE WHEN p.total_bets > 0 THEN ROUND(p.total_won::numeric / p.total_bets * 100) ELSE 0 END AS win_rate
FROM profiles p
LEFT JOIN bets b ON b.user_id = p.id AND b.status != 'pending'
GROUP BY p.id, p.username, p.is_bot, p.balance, p.total_bets, p.total_won
ORDER BY profit DESC;
