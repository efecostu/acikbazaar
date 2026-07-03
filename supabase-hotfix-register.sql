-- ============================================================
-- HOTFIX: "Database error saving new user" kayıt hatası
-- auth.users üzerindeki eski/çakışan trigger'ları temizler ve
-- handle_new_user'ı asla-patlamaz hale getirir.
-- Supabase SQL Editor'da çalıştır (migration-5'ten sonra)
-- ============================================================

-- 1. auth.users üzerindeki TÜM eski trigger'ları kaldır (çakışma ihtimaline karşı)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', r.tgname);
  END LOOP;
END $$;

-- 2. Savunmacı handle_new_user:
--    - kullanıcı adı çakışırsa sonek ekler
--    - HER durumda RETURN NEW yapar — profil oluşturulamazsa bile kayıt
--      engellenmez (layout'taki fallback profili sonradan oluşturur)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Profil oluşturma asla kayıt işlemini bloklamasın
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
