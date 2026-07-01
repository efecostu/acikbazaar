-- ============================================================
-- AçıkBazaar — Migration 2: Güvenli atomik bahis + RLS sıkılaştırma
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Resolve zamanı kolonu (günlük rapor bunu sorguluyor)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. GÜVENLİK: tehlikeli policy'leri kaldır
--    - profiles_update: kullanıcı kendi balance'ını console'dan değiştirebiliyordu
--    - markets_insert/update: herkes market oluşturup resolve edebiliyordu
--    (Servis rolü RLS'i zaten bypass eder; admin işlemleri etkilenmez)
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "markets_insert" ON markets;
DROP POLICY IF EXISTS "markets_update" ON markets;

-- 3. Atomik bahis fonksiyonu — doğrulama + bakiye + havuz + bet tek transaction
CREATE OR REPLACE FUNCTION place_bet(p_market_id UUID, p_side TEXT, p_amount INTEGER)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_yes_pool INTEGER;
  v_no_pool INTEGER;
  v_status TEXT;
  v_ends_at TIMESTAMPTZ;
  v_total INTEGER;
  v_prob FLOAT;
  v_odds FLOAT;
  v_payout INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_side NOT IN ('yes','no') THEN
    RAISE EXCEPTION 'invalid_side';
  END IF;

  SELECT status, ends_at, yes_pool, no_pool
  INTO v_status, v_ends_at, v_yes_pool, v_no_pool
  FROM markets WHERE id = p_market_id FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'market_not_found'; END IF;
  IF v_status <> 'active' OR v_ends_at < NOW() THEN RAISE EXCEPTION 'market_closed'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  -- Oran hesabı — lib/odds.ts ile birebir aynı: %3 fee, 0.02–0.98 clamp
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

  UPDATE profiles
  SET balance = balance - p_amount, total_bets = total_bets + 1
  WHERE id = v_user_id;

  IF p_side = 'yes' THEN
    UPDATE markets SET
      yes_pool = yes_pool + p_amount,
      yes_prob = (yes_pool + p_amount)::float / (yes_pool + no_pool + p_amount),
      total_volume = total_volume + p_amount,
      participant_count = participant_count + 1
    WHERE id = p_market_id;
  ELSE
    UPDATE markets SET
      no_pool = no_pool + p_amount,
      yes_prob = yes_pool::float / (yes_pool + no_pool + p_amount),
      total_volume = total_volume + p_amount,
      participant_count = participant_count + 1
    WHERE id = p_market_id;
  END IF;

  INSERT INTO bets (user_id, market_id, side, amount, odds_at_bet, potential_payout, status)
  VALUES (v_user_id, p_market_id, p_side, p_amount, v_odds, v_payout, 'pending');

  RETURN json_build_object(
    'new_balance', v_balance - p_amount,
    'odds', v_odds,
    'potential_payout', v_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION place_bet(UUID, TEXT, INTEGER) TO authenticated;
