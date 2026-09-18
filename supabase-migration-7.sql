-- ============================================================
-- AçıkBazaar — Migration 7: Çözüm gerekçesi, "sonuç bekleniyor" durumu,
-- performans indeksleri, yorum spam koruması
-- Supabase SQL Editor'da çalıştır (migration-6 ve hotfix'ten SONRA)
-- ============================================================

-- 1. Çözüm gerekçesi (cron / admin kararın kaynağını yazar, market sayfasında gösterilir)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- 2. Süresi dolmuş ama henüz çözülmemiş marketler 'closed' (sonuç bekleniyor) olur.
--    CHECK zaten ('active','closed','resolved') — burada sadece mevcut verileri düzeltiyoruz.
UPDATE markets SET status = 'closed'
WHERE status = 'active' AND ends_at < NOW();

-- 3. place_bet / place_bet_option zaten status <> 'active' için market_closed atıyor. Ek güvenlik:
--    süresi dolan markete kimse bahis koyamasın (fonksiyonlar ends_at < NOW() kontrolü yapıyor).

-- 4. Sık sorgular için indeksler
CREATE INDEX IF NOT EXISTS markets_status_ends_idx ON markets(status, ends_at);
CREATE INDEX IF NOT EXISTS markets_created_idx ON markets(created_at DESC);
CREATE INDEX IF NOT EXISTS bets_user_created_idx ON bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bets_market_status_idx ON bets(market_id, status);
CREATE INDEX IF NOT EXISTS bets_created_idx ON bets(created_at DESC);

-- 5. Yorum spam koruması: kullanıcı başına dakikada en fazla 5, günde 100 yorum
CREATE OR REPLACE FUNCTION check_comment_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM comments
      WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 minute') >= 5 THEN
    RAISE EXCEPTION 'rate_limit';
  END IF;
  IF (SELECT COUNT(*) FROM comments
      WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 day') >= 100 THEN
    RAISE EXCEPTION 'rate_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS comment_rate_limit ON comments;
CREATE TRIGGER comment_rate_limit
  BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION check_comment_rate_limit();

-- 6. Kullanıcı adı kuralları: 3-20 karakter, küçük harf/rakam/alt çizgi
--    (mevcut kayıtlar bozulmasın diye NOT VALID — sadece yeni kayıtlarda uygulanır)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9_]{3,20}$') NOT VALID;

-- 7. Platform istatistikleri (landing sayfası gerçek sayılar gösterir)
CREATE OR REPLACE FUNCTION platform_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'users',   (SELECT COUNT(*) FROM profiles WHERE COALESCE(is_bot, false) = false),
    'bets',    (SELECT COUNT(*) FROM bets),
    'volume',  (SELECT COALESCE(SUM(total_volume), 0) FROM markets),
    'active',  (SELECT COUNT(*) FROM markets WHERE status = 'active' AND ends_at > NOW()),
    'resolved',(SELECT COUNT(*) FROM markets WHERE status = 'resolved')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION platform_stats() TO anon, authenticated;
