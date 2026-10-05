-- ============================================================
-- MIGRATION 12 (2026-10-05): ilk 4 botun şişik rakamlarını /10 normalize et
--
-- KahinKemal, BorsaKurdu, AnalizciAyse, SkeptikSelin Temmuz'dan beri ~1.200'er bahis yaptı;
-- sıralamada 0,5–1,3M kâr görünüyordu. Bahis tutarı, potansiyel ödeme, bakiye ve
-- total_won /10 yapılır → kâr 50–130K bandına iner. Market havuzları/oranları DEĞİŞMEZ.
--
-- Önce yedek alınır; geri almak için dosyanın sonundaki ROLLBACK bloğunu çalıştır.
-- Tekrar çalıştırılırsa ikinci kez bölmez (yedek tablosu doluysa durur).
-- ============================================================

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM profiles
  WHERE is_bot AND username IN ('KahinKemal', 'BorsaKurdu', 'AnalizciAyse', 'SkeptikSelin');

  IF to_regclass('public.bot_normalize_backup_bets') IS NOT NULL THEN
    RAISE NOTICE 'Zaten normalize edilmiş (yedek tablosu var), atlanıyor.';
    RETURN;
  END IF;

  CREATE TABLE public.bot_normalize_backup_bets AS
    SELECT id, amount, potential_payout FROM bets WHERE user_id = ANY(v_ids);
  CREATE TABLE public.bot_normalize_backup_profiles AS
    SELECT id, balance, total_won FROM profiles WHERE id = ANY(v_ids);
  ALTER TABLE public.bot_normalize_backup_bets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.bot_normalize_backup_profiles ENABLE ROW LEVEL SECURITY;

  UPDATE bets SET
    amount = GREATEST(1, ROUND(amount / 10.0)),
    potential_payout = GREATEST(1, ROUND(potential_payout / 10.0))
  WHERE user_id = ANY(v_ids);

  UPDATE profiles SET
    balance = ROUND(balance / 10.0),
    total_won = ROUND(COALESCE(total_won, 0) / 10.0)
  WHERE id = ANY(v_ids);
END $$;

-- Kontrol: 4 bot 50K–135K bandında olmalı
SELECT username, balance, total_bets, profit, open_positions
FROM leaderboard ORDER BY profit DESC LIMIT 8;

-- ---------------- ROLLBACK (gerekirse ayrıca çalıştır) ----------------
-- UPDATE bets b SET amount = k.amount, potential_payout = k.potential_payout
--   FROM bot_normalize_backup_bets k WHERE b.id = k.id;
-- UPDATE profiles p SET balance = k.balance, total_won = k.total_won
--   FROM bot_normalize_backup_profiles k WHERE p.id = k.id;
-- DROP TABLE bot_normalize_backup_bets, bot_normalize_backup_profiles;
