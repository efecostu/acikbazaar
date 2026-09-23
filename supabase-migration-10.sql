-- ============================================================
-- AçıkBazaar — Migration 10: GÜVENLİK sıkılaştırması + atomik bot bahsi
-- Supabase SQL Editor'da çalıştır (migration-9'dan SONRA). İdempotent.
--
-- Kapatılan açıklar:
--  1. bets_insert_own policy'si hâlâ açıktı → kullanıcı place_bet'i atlayıp
--     tarayıcı konsolundan istediği potential_payout ile bahis ekleyebiliyordu
--     (market çözülünce o tutar ödeniyordu).
--  2. credit_and_update_user / increment_* / apply_streak SECURITY DEFINER ve
--     herkese EXECUTE yetkili → anon kullanıcı bile RPC ile kendine kredi yazabiliyordu.
--  3. profiles_insert policy'si → profili olmayan kullanıcı istediği bakiyeyle profil açabiliyordu.
--  4. market_suggestions insert'inde status serbestti.
-- ============================================================

-- 1. Doğrudan bahis ekleme yok — bahis sadece place_bet / place_bet_option RPC'leri ile
DROP POLICY IF EXISTS "bets_insert_own" ON bets;

-- 2. Profil sadece auth trigger'ı / servis rolü ile oluşur
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- 3. Sunucu-içi yardımcı fonksiyonlar: sadece service_role çağırabilir
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.credit_and_update_user(uuid, integer)',
    'public.increment_market_pool(uuid, text, integer)',
    'public.increment_user_bet_count(uuid)',
    'public.apply_streak(uuid)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- 4. SECURITY DEFINER fonksiyonlarda sabit search_path (şema gölgeleme saldırısına karşı)
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.place_bet(uuid, text, integer)',
    'public.place_bet_option(uuid, uuid, integer)',
    'public.set_interests(text[])',
    'public.platform_stats()',
    'public.credit_and_update_user(uuid, integer)',
    'public.increment_market_pool(uuid, text, integer)',
    'public.increment_user_bet_count(uuid)',
    'public.check_suggestion_rate_limit()',
    'public.check_comment_rate_limit()',
    'public.handle_new_user()'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- 5. Streak artık İstanbul tarihine göre (UTC gece yarısı 03:00 TRT'de seri bozuyordu)
CREATE OR REPLACE FUNCTION public.apply_streak(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Europe/Istanbul')::date;
  v_last DATE;
  v_streak INTEGER;
  v_bonus INTEGER := 0;
BEGIN
  SELECT last_bet_date, streak_count INTO v_last, v_streak FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_last >= v_today THEN
    RETURN json_build_object('streak', COALESCE(v_streak, 0), 'bonus', 0);
  ELSIF v_last = v_today - 1 THEN
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
  SET streak_count = v_streak, last_bet_date = v_today, balance = balance + v_bonus
  WHERE id = p_user_id;
  RETURN json_build_object('streak', v_streak, 'bonus', v_bonus);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.apply_streak(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_streak(UUID) TO service_role;

-- 6. Bakiye düzeltme (çözüm geri alma, market silinince iade) — tek atomik UPDATE
CREATE OR REPLACE FUNCTION public.adjust_balance(p_user_id UUID, p_delta INTEGER, p_won_delta INTEGER DEFAULT 0)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET balance = balance + p_delta,
      total_won = GREATEST(0, COALESCE(total_won, 0) + p_won_delta)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.adjust_balance(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_balance(UUID, INTEGER, INTEGER) TO service_role;

-- 7. Atomik bot bahsi: /api/bots/tick eskiden havuzları okuyup üzerine yazıyordu;
--    aynı anda gelen gerçek kullanıcı bahsi kayboluyordu (lost update). Artık place_bet ile aynı kilit.
CREATE OR REPLACE FUNCTION public.bot_place_bet(p_user_id UUID, p_market_id UUID, p_side TEXT, p_amount INTEGER)
RETURNS JSON AS $$
DECLARE
  v_status TEXT;
  v_kind TEXT;
  v_ends_at TIMESTAMPTZ;
  v_yes_pool INTEGER;
  v_no_pool INTEGER;
  v_total INTEGER;
  v_prob FLOAT;
  v_odds FLOAT;
  v_payout INTEGER;
  v_new_yes_prob FLOAT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND COALESCE(is_bot, false)) THEN
    RAISE EXCEPTION 'not_a_bot';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_side NOT IN ('yes','no') THEN RAISE EXCEPTION 'invalid_side'; END IF;

  SELECT status, kind, ends_at, yes_pool, no_pool
  INTO v_status, v_kind, v_ends_at, v_yes_pool, v_no_pool
  FROM markets WHERE id = p_market_id FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'market_not_found'; END IF;
  IF COALESCE(v_kind, 'binary') <> 'binary' THEN RAISE EXCEPTION 'wrong_market_kind'; END IF;
  IF v_status <> 'active' OR v_ends_at < NOW() THEN RAISE EXCEPTION 'market_closed'; END IF;

  -- Botun kredisi bitmesin (sıralama kârı bahis sonuçlarından hesaplanır, bakiyeden değil)
  UPDATE profiles SET balance = balance + 100000 WHERE id = p_user_id AND balance < p_amount;

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

  UPDATE profiles SET balance = balance - p_amount, total_bets = total_bets + 1 WHERE id = p_user_id;

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
  VALUES (p_user_id, p_market_id, p_side, p_amount, v_odds, v_payout, 'pending');
  INSERT INTO market_prob_history (market_id, yes_prob) VALUES (p_market_id, v_new_yes_prob);

  RETURN json_build_object('yes_prob', v_new_yes_prob, 'odds', v_odds, 'potential_payout', v_payout);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.bot_place_bet(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_place_bet(UUID, UUID, TEXT, INTEGER) TO service_role;

-- 8. Öneri: kullanıcı status alanını kendisi 'approved' yapamasın
CREATE OR REPLACE FUNCTION public.check_suggestion_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM market_suggestions
      WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'rate_limit';
  END IF;
  NEW.status := 'pending';
  NEW.created_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Davet: migration-9 referral_count sayacını ve bot hariç tutmayı düşürmüştü; büyük/küçük harf duyarsız eşleşme
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_ref TEXT;
  v_referrer UUID;
BEGIN
  v_username := public.sanitize_username(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email, 'user'));
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN
    v_username := substr(v_username, 1, 15) || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  v_ref := NULLIF(NEW.raw_user_meta_data->>'ref', '');
  IF v_ref IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles
    WHERE lower(username) = lower(v_ref) AND id <> NEW.id AND COALESCE(is_bot, false) = false
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, username, balance, referred_by)
  VALUES (NEW.id, v_username, 100000 + CASE WHEN v_referrer IS NOT NULL THEN 5000 ELSE 0 END, v_referrer)
  ON CONFLICT (id) DO NOTHING;

  IF v_referrer IS NOT NULL THEN
    UPDATE public.profiles
    SET balance = balance + 5000, referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = v_referrer;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Geçmiş davetlerin sayacını düzelt
UPDATE profiles p SET referral_count = sub.c
FROM (SELECT referred_by AS id, COUNT(*)::int AS c FROM profiles WHERE referred_by IS NOT NULL GROUP BY referred_by) sub
WHERE p.id = sub.id AND COALESCE(p.referral_count, 0) <> sub.c;

-- 10. Yorum rate-limit sorgusu için indeks
CREATE INDEX IF NOT EXISTS comments_user_created_idx ON comments(user_id, created_at DESC);

-- Kontrol: aşağıdaki sorgu 0 satır döndürmeli (bets tablosunda INSERT policy'si kalmamalı)
SELECT policyname FROM pg_policies WHERE tablename = 'bets' AND cmd = 'INSERT';
