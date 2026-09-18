-- ============================================================
-- AçıkBazaar — Migration 8: Haftalık sıralama + davet (referral) sistemi
-- Supabase SQL Editor'da çalıştır (migration-7'den SONRA)
-- ============================================================

-- 1. Haftalık sıralama: son 7 günde kapanan bahislerden kâr
CREATE OR REPLACE VIEW leaderboard_weekly AS
SELECT
  p.username,
  p.is_bot,
  p.balance,
  COUNT(b.id)::int                                            AS total_bets,
  COUNT(b.id) FILTER (WHERE b.status = 'won')::int            AS total_won,
  COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.potential_payout - b.amount ELSE -b.amount END), 0)::bigint AS profit,
  CASE WHEN COUNT(b.id) > 0
       THEN ROUND(COUNT(b.id) FILTER (WHERE b.status = 'won')::numeric / COUNT(b.id) * 100)
       ELSE 0 END                                             AS win_rate
FROM profiles p
JOIN bets b ON b.user_id = p.id
  AND b.status IN ('won', 'lost')
  AND b.settled_at > NOW() - INTERVAL '7 days'
GROUP BY p.id, p.username, p.is_bot, p.balance
ORDER BY profit DESC;

-- 2. Davet sistemi
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Kayıt trigger'ı: ref=kullanıcıadı geldiyse davet edeni bul, iki tarafa da ◈5.000 ver.
-- Her durumda RETURN NEW — profil/davet hatası kaydı asla engellemez.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_ref TEXT;
  v_referrer UUID;
BEGIN
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1),
    'user'
  );
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := v_username || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, username, balance)
  VALUES (NEW.id, v_username, 100000)
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    v_ref := lower(NULLIF(NEW.raw_user_meta_data->>'ref', ''));
    IF v_ref IS NOT NULL THEN
      SELECT id INTO v_referrer FROM public.profiles
      WHERE username = v_ref AND id <> NEW.id AND COALESCE(is_bot, false) = false;
      IF v_referrer IS NOT NULL THEN
        UPDATE public.profiles SET referred_by = v_referrer, balance = balance + 5000 WHERE id = NEW.id;
        UPDATE public.profiles SET referral_count = COALESCE(referral_count, 0) + 1, balance = balance + 5000 WHERE id = v_referrer;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
