-- ============================================================
-- Migration 9: kullanıcı adı kısıtı düzeltmesi + canlı (mark-to-market) sıralama
-- Supabase SQL Editor'da çalıştır. İdempotent.
-- ============================================================

-- 1. Kullanıcı adı kısıtı: büyük harfe izin ver (bot isimleri KahinKemal vb.).
--    Migration 7'deki NOT VALID kısıt UPDATE'lerde de çalışıyordu; e-posta biçimli
--    eski kullanıcı adları ve bot isimleri yüzünden bahis / bakiye güncellemeleri patlıyordu.
CREATE OR REPLACE FUNCTION public.sanitize_username(raw TEXT)
RETURNS TEXT AS $$
DECLARE v TEXT;
BEGIN
  v := lower(split_part(COALESCE(raw, ''), '@', 1));
  v := translate(v, 'çğıöşüâîû', 'cgiosuaiu');
  v := regexp_replace(v, '[^a-z0-9_]', '', 'g');
  v := substr(v, 1, 20);
  IF length(v) < 3 THEN v := 'user_' || substr(md5(random()::text), 1, 6); END IF;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;

-- Mevcut bozuk kayıtları temizle (çakışırsa sonek ekle)
DO $$
DECLARE r RECORD; v TEXT;
BEGIN
  FOR r IN SELECT id, username FROM profiles WHERE username !~ '^[A-Za-z0-9_]{3,20}$' LOOP
    v := public.sanitize_username(r.username);
    IF EXISTS (SELECT 1 FROM profiles WHERE username = v AND id <> r.id) THEN
      v := substr(v, 1, 15) || '_' || substr(r.id::text, 1, 4);
    END IF;
    UPDATE profiles SET username = v WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[A-Za-z0-9_]{3,20}$');

-- handle_new_user artık her zaman geçerli bir kullanıcı adı üretir
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_ref TEXT;
  v_referrer UUID;
BEGIN
  v_username := public.sanitize_username(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email, 'user'));
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := substr(v_username, 1, 15) || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  v_ref := NULLIF(NEW.raw_user_meta_data->>'ref', '');
  IF v_ref IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE username = v_ref AND id <> NEW.id LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, username, balance, referred_by)
  VALUES (NEW.id, v_username, 100000 + CASE WHEN v_referrer IS NOT NULL THEN 5000 ELSE 0 END, v_referrer)
  ON CONFLICT (id) DO NOTHING;

  IF v_referrer IS NOT NULL THEN
    UPDATE public.profiles SET balance = balance + 5000 WHERE id = v_referrer;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Canlı sıralama: açık pozisyonlar güncel orana göre değerlenir (mark-to-market).
--    profit = gerçekleşen kâr + açık pozisyonların anlık kâr/zararı → oranlar oynadıkça tablo değişir.
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
WITH pos AS (
  SELECT
    b.user_id,
    SUM(CASE WHEN b.status = 'won'  THEN b.potential_payout - b.amount
             WHEN b.status = 'lost' THEN -b.amount ELSE 0 END)::bigint AS realized,
    SUM(CASE WHEN b.status = 'pending' AND b.side IS NOT NULL THEN
          ROUND(b.potential_payout * (CASE WHEN b.side = 'yes' THEN m.yes_prob ELSE 1 - m.yes_prob END)) - b.amount
        ELSE 0 END)::bigint AS unrealized,
    COUNT(*) FILTER (WHERE b.status = 'pending')::int AS open_positions
  FROM bets b
  JOIN markets m ON m.id = b.market_id
  GROUP BY b.user_id
)
SELECT
  p.username, p.is_bot, p.balance, p.total_bets, p.total_won,
  COALESCE(pos.realized, 0) + COALESCE(pos.unrealized, 0) AS profit,
  COALESCE(pos.realized, 0)   AS realized,
  COALESCE(pos.unrealized, 0) AS unrealized,
  COALESCE(pos.open_positions, 0) AS open_positions,
  CASE WHEN p.total_bets > 0 THEN ROUND(p.total_won::numeric / p.total_bets * 100) ELSE 0 END AS win_rate
FROM profiles p
LEFT JOIN pos ON pos.user_id = p.id
ORDER BY profit DESC;

DROP VIEW IF EXISTS leaderboard_weekly;
CREATE VIEW leaderboard_weekly AS
WITH pos AS (
  SELECT
    b.user_id,
    COUNT(*)::int AS total_bets,
    COUNT(*) FILTER (WHERE b.status = 'won')::int AS total_won,
    SUM(CASE WHEN b.status = 'won'  THEN b.potential_payout - b.amount
             WHEN b.status = 'lost' THEN -b.amount ELSE 0 END)::bigint AS realized,
    SUM(CASE WHEN b.status = 'pending' AND b.side IS NOT NULL THEN
          ROUND(b.potential_payout * (CASE WHEN b.side = 'yes' THEN m.yes_prob ELSE 1 - m.yes_prob END)) - b.amount
        ELSE 0 END)::bigint AS unrealized,
    COUNT(*) FILTER (WHERE b.status = 'pending')::int AS open_positions
  FROM bets b
  JOIN markets m ON m.id = b.market_id
  WHERE COALESCE(b.settled_at, b.created_at) > NOW() - INTERVAL '7 days'
  GROUP BY b.user_id
)
SELECT
  p.username, p.is_bot, p.balance,
  pos.total_bets, pos.total_won,
  pos.realized + pos.unrealized AS profit,
  pos.realized, pos.unrealized, pos.open_positions,
  CASE WHEN pos.total_bets > 0 THEN ROUND(pos.total_won::numeric / pos.total_bets * 100) ELSE 0 END AS win_rate
FROM profiles p
JOIN pos ON pos.user_id = p.id
ORDER BY profit DESC;

GRANT SELECT ON leaderboard, leaderboard_weekly TO anon, authenticated;

SELECT username, profit, realized, unrealized, open_positions FROM leaderboard LIMIT 10;
