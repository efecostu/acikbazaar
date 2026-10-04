-- ============================================================
-- HOTFIX (2026-10-04): kayıt olan kullanıcıların profili oluşmuyor
--
-- Prod'da migration-9 uygulanmış ama migration-8 uygulanmamış. Migration-9'un
-- handle_new_user'ı profiles.referred_by'a yazıyor; kolon olmadığı için INSERT
-- patlıyor ve EXCEPTION WHEN OTHERS bunu yutuyor → auth kullanıcısı var, profil yok.
--
-- migration-8'in TAMAMINI çalıştırma: leaderboard_weekly'yi migration-9'un
-- mark-to-market sürümünün üzerine eski haliyle yazar. Sadece kolonları ekliyoruz.
--
-- Sıra: 1) bu dosya  2) supabase-migration-10.sql
-- ============================================================

-- 1. migration-8'den sadece kolonlar
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- 2. Profili olmayan auth kullanıcılarını doldur (davet bonusu geriye dönük verilmez)
INSERT INTO public.profiles (id, username, balance)
SELECT
  u.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.username) = lower(public.sanitize_username(COALESCE(NULLIF(u.raw_user_meta_data->>'username', ''), u.email, 'user')))
    )
    THEN substr(public.sanitize_username(COALESCE(NULLIF(u.raw_user_meta_data->>'username', ''), u.email, 'user')), 1, 15) || '_' || substr(u.id::text, 1, 4)
    ELSE public.sanitize_username(COALESCE(NULLIF(u.raw_user_meta_data->>'username', ''), u.email, 'user'))
  END,
  100000
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Kontrol: 0 dönmeli
SELECT COUNT(*) AS profilsiz_kullanici
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
