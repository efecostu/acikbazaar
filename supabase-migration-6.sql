-- ============================================================
-- AçıkBazaar — Migration 6: Gerçek zamanlı akış (Realtime)
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Realtime yayınına tabloları ekle (zaten ekliyse hata verme)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE markets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE bets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2. Son işlemler şeridi: bahisler herkese görünür (Manifold/Polymarket gibi
--    tüm işlemler kamuya açık — kullanıcı adı zaten public profil bilgisi)
DROP POLICY IF EXISTS "bets_select_public" ON bets;
CREATE POLICY "bets_select_public" ON bets FOR SELECT USING (true);
