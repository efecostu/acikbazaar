# AçıkBazaar

Türkiye'nin ücretsiz tahmin pazarı simülasyonu. Gerçek para yok; herkes ◈100.000 sanal krediyle başlar, gerçek hayat sorularına EVET/HAYIR der, sıralamada yarışır. Marketler Claude + web search ile üretilir ve otomatik çözülür.

**Canlı:** https://acikbazaar.com · **Stack:** Next.js 16 (App Router, Turbopack) · Supabase (Postgres, Auth, Realtime) · Anthropic Claude · Resend · Vercel

---

## Kurulum (local)

```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev                  # http://localhost:3000
```

`NEXT_PUBLIC_SUPABASE_URL` boşsa ya da `demo.supabase.co` içeriyorsa uygulama **demo modda** çalışır (sahte marketler, kayıt kapalı).

## Veritabanı

Supabase SQL Editor'da sırayla çalıştır (hepsi idempotent, tekrar çalıştırmak güvenli):

1. `supabase-schema.sql` — tablolar, RLS, seed
2. `supabase-migration-2.sql` — atomik `place_bet`, RLS sıkılaştırma
3. `supabase-migration-3.sql` — yorumlar, botlar
4. `supabase-migration-4.sql` — market önerileri
5. `supabase-migration-5.sql` — 100K kredi, streak, olasılık geçmişi, çoklu seçenek
6. `supabase-migration-6.sql` — Realtime yayını, public bahis akışı
7. `supabase-hotfix-register.sql` — kayıt trigger'ı (her zaman RETURN NEW)
8. `supabase-migration-7.sql` — çözüm gerekçesi, "sonuç bekleniyor" durumu, indeksler, yorum rate-limit, `platform_stats()`
9. `supabase-migration-8.sql` — haftalık sıralama görünümü (`leaderboard_weekly`), davet sistemi (`?ref=kullaniciadi`, iki tarafa ◈5.000)

Supabase → Authentication → URL Configuration:
- **Site URL:** `https://acikbazaar.com` (localhost bırakılırsa doğrulama e-postaları localhost'a gider)
- **Redirect URLs:** `https://acikbazaar.com/auth/callback`, `http://localhost:3000/auth/callback`

## Otomasyon (Vercel Cron — `vercel.json`)

| Saat (UTC) | Endpoint | Ne yapar |
|---|---|---|
| 06:00 | `/api/cron/resolve` | Süresi dolan marketleri web search ile çözer ve öder; karar veremezse `closed` (sonuç bekleniyor) yapar; hâlâ açık marketlerde erken kesinleşme tarar; açık market sayısını `TARGET_ACTIVE_MARKETS`'a tamamlar |
| 07:00 | `/api/cron/report` | Günlük operasyon raporunu e-postayla gönderir |

Cron istekleri `Authorization: Bearer $CRON_SECRET` taşır. **`CRON_SECRET` Vercel'de tanımlı değilse cron 401 alır.** Aynı işleri admin panelinden (`/admin` → Operasyon Sağlığı → "Şimdi çöz + tamamla") ya da manuel olarak tetikleyebilirsin:

```bash
curl -H "x-admin-secret: $ADMIN_SECRET" https://acikbazaar.com/api/cron/resolve
curl -H "x-admin-secret: $ADMIN_SECRET" -X POST -H 'Content-Type: application/json' \
  -d '{"topUp":true}' https://acikbazaar.com/api/ai/generate
```

## Botlar (sürekli canlılık)

Dört bot (`is_bot = true`) `/api/bots/tick` ile bahis yapar: her tick 2-4 bahis, 12 dk throttle, 02:00-07:00 TRT arası uyur, her bot+market ikilisi için sabit "kanaat" (aynı bot aynı markette tutarlı), az bahis alan ve yakında kapanacak marketlere öncelik. Tetikleyiciler:

- Sayfa ziyaretleri: landing, market listesi ve market detayı yanıt sonrası tick'i dürter (`lib/botTrigger.ts`).
- Harici zamanlayıcı (önerilir, Hobby planda 3. cron yok): [cron-job.org](https://cron-job.org) gibi ücretsiz bir servisten her 15 dakikada `GET https://acikbazaar.com/api/bots/tick` çağır, header: `x-admin-secret: <ADMIN_SECRET>`.
- Elle patlama: `?force=1&burst=25` ile throttle'ı atlayıp 25 bahis üretir (yeni market seti yükledikten sonra hacim kazandırmak için).

```bash
curl -H "x-admin-secret: $ADMIN_SECRET" "https://acikbazaar.com/api/bots/tick?force=1&burst=25"
```

### Bot yorumları

Her bahse bir yorum. Model seçimi `lib/llm.ts`: `LLM_BASE_URL` + `LLM_API_KEY` (+ `LLM_MODEL`) tanımlıysa OpenAI uyumlu ucuz bir model (Qwen Flash, OpenRouter, Groq, DeepSeek), yoksa `ANTHROPIC_API_KEY`, o da yoksa şablon havuzu. Market üretimi ve otomatik çözüm web araması gerektirdiği için Anthropic'te kalır.


`lib/botVoice.ts`: her botun sesi (Ekşi/Twitter/İnci ağzı) + few-shot örnek yorumları. Prompt'a humanizer ilkeleri gömülü (sahneleme yok, kapanış cümlesi yok, üçlü liste yok, tire yok, emoji/hashtag yok, uydurma rakam yok). Normal tick'te %35 ihtimalle yorum; aynı markete 2 saat içinde ikinci bot yorumu yazılmaz. Anthropic anahtarı yoksa bot başına şablon havuzundan seçer. `sanitizeComment` modelin kaçırdığı emoji/tire/uzunluğu düzeltir.

## Market seti (AI olmadan)

`supabase-seed-markets-2026-09.sql` elle küratörlü, güncel gündeme dayalı 39 market içerir (spor, ekonomi, siyaset, teknoloji, eğlence, hava, dünya). İdempotenttir; SQL Editor'da çalıştırıp ardından bot burst'ü tetikleyin. Anthropic anahtarı çalışınca cron bu seti otomatik üretimle tamamlar.

## Akış (/activity)

Son 150 bahsi listeler: saat (TRT), kim (bot/kullanıcı ikonu), market, taraf, miktar, oran. Filtreler: hepsi / kullanıcılar / botlar / 5K+. Üstte son 24 saat özeti. Servis rolü ile okunur (RLS'den bağımsız), kullanıcı adı dışında kimlik bilgisi göstermez.

## Sıralama (migration 9)

`supabase-migration-9.sql` iki şey yapar: kullanıcı adı kısıtını düzeltir (e-posta biçimli eski adları temizler, bot isimlerine izin verir; bu kısıt yüzünden bahis sırasında `profiles_username_format` hatası geliyordu) ve sıralamayı canlı hale getirir. `profit` = gerçekleşen kâr + açık pozisyonların güncel orana göre değeri (mark-to-market); botlar oranı oynattıkça tablo değişir.

## Gece raporu

Çözüm cron'u (06:00 UTC, 09:00 TRT) bittiği anda `lib/report.ts` e-posta gönderir: cron'un o gece çözdüğü her market (sonuç, güven, gerekçe, ERKEN etiketi, kazanan/kaybeden), karar veremedikleri, hatalar, üretilen marketler, sonuç bekleyenler, 3 gün içinde kapanacaklar, kullanıcı bahisleri ve yorumları, bot yorum örnekleri, yeni kullanıcılar, bekleyen öneriler, canlı sıralama. Üstte "Dikkat" kutusu. Alıcılar `REPORT_EMAILS` (virgülle) yoksa `ADMIN_EMAIL`. Manuel: `GET /api/cron/resolve?report=1` (sweep + rapor) veya `GET /api/cron/report` (sadece rapor).

## Modeller ve maliyet

- Bot yorumları: `LLM_*` (OpenRouter, `google/gemini-2.5-flash-lite`, ~0,00005 $/yorum).
- Vadesi gelen market çözümü ve market üretimi: `ANTHROPIC_MODEL` (varsayılan Haiku 4.5) + Anthropic web araması (arama başına 0,01 $).
- Erken çözüm taraması (günde 1 çağrı, tüm açık marketler): `ANTHROPIC_MODEL_STRONG` (varsayılan Sonnet 4.6). Hata burada pahalı çünkü ödeme dağıtılır; güven eşiği 0,95 ve sert kurallar (gelecekte açıklanacak veri asla erken çözülmez, "yılın en" tipi sorular dönem bitmeden çözülmez).
- Maliyet kapakları: vadesi gelen market başına en fazla 3 arama, erken tarama en fazla 8 arama, üretim batch'i en fazla 4 arama. Erken tarama yalnızca Pazartesi ve Perşembe çalışır (`EARLY_SCAN_DAYS`, UTC gün numaraları, 0=Pazar). Tahmini günlük maliyet: 0,05-0,20 $; erken tarama günlerinde +0,15 $.
- Yanlış çözüm: admin market sayfasında "Geri aç" ödemeleri iade alır ve bahisleri beklemeye döndürür. API: `POST /api/admin/unsettle {market_id}` + `x-admin-secret`.

## Market yaşam döngüsü

`active` → (ends_at geçti) → cron çözer → `resolved` (bahisler ödenir, `resolution_note` yazılır)
`active` → (ends_at geçti, karar verilemedi) → `closed` = "sonuç bekleniyor" (bahis alınmaz; ertesi gün tekrar denenir; admin elle çözebilir)

Tüm çözüm yolları (`cron`, admin paneli, `/api/markets/settle`) tek fonksiyondan geçer: `lib/settle.ts`. Bahis alma tamamen DB tarafında atomik: `place_bet` / `place_bet_option` RPC'leri.

## Dizin haritası

```
app/(auth)/        login, register, forgot-password, reset-password
app/auth/callback  Supabase e-posta linklerini oturuma çevirir (PKCE)
app/(app)/         markets, markets/[id], portfolio, leaderboard, profile, onboarding, suggest
app/admin/         dashboard (ops sağlığı), markets CRUD, öneriler, bahisler
app/api/           cron/resolve, cron/report, ai/generate, markets, markets/settle, bots/tick
lib/settle.ts      tek çözüm/ödeme fonksiyonu
lib/resolve.ts     günlük tarama (due + early + top-up)
lib/generate.ts    Claude ile market üretimi + top-up
lib/notify.ts      kazanç e-postaları
lib/badges.ts      profil rozetleri (DB'siz, bahis geçmişinden hesaplanır)
components/ShareBar.tsx  X / WhatsApp / Telegram / kopyala paylaşım şeridi
proxy.ts           Supabase oturum yenileme (Next 16'da middleware'in adı)
```

## Doğrulama

```bash
npx tsc --noEmit && npm run build
```
