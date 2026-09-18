-- ============================================================
-- AçıkBazaar — Eylül 2026 gündem market seti (39 market)
-- Elle küratörlü, güncel Türkiye gündemi. Supabase SQL Editor'da çalıştır.
-- İdempotent: aynı title_tr varsa atlar. Her marketin net bitiş tarihi ve
-- doğrulanabilir çözüm kriteri var (cron web search ile çözer).
-- ============================================================

WITH seed(title_tr, title_en, description_tr, description_en, category, region, yes_prob, volume, ends_at, tag) AS (VALUES
  -- ---------- SPOR ----------
  ('Galatasaray 26 Ekim derbisinde Fenerbahçe''yi yener mi?', 'Will Galatasaray beat Fenerbahçe in the 26 October derby?',
   '26 Ekim 2026 Süper Lig derbisi (RAMS Park, 21:30). 90 dakika sonunda Galatasaray galipse EVET; beraberlik veya Fenerbahçe galibiyeti HAYIR. Kaynak: TFF.', 'Süper Lig derby on 26 Oct 2026. YES if Galatasaray wins after 90 minutes; draw or Fenerbahçe win = NO. Source: TFF.',
   'sports','turkey',0.52,180000,'2026-10-26T21:00:00Z','hot'),
  ('Türkiye 25 Eylül''de Fransa''yı yener mi?', 'Will Türkiye beat France on 25 September?',
   'UEFA Uluslar Ligi A, 25 Eylül 2026, Türkiye-Fransa. 90 dakika sonunda Türkiye galipse EVET. Kaynak: UEFA.', 'UEFA Nations League A, 25 Sep 2026, Türkiye v France. YES if Türkiye wins in 90 minutes. Source: UEFA.',
   'sports','turkey',0.24,90000,'2026-09-25T21:00:00Z','trending'),
  ('Türkiye Uluslar Ligi''nde Eylül-Ekim penceresinde en az 1 maç kazanır mı?', 'Will Türkiye win at least one Nations League match in the Sep-Oct window?',
   'Fransa (25 Eyl), İtalya (28 Eyl), Belçika (2 Eki), İtalya (5 Eki) maçlarından en az birinde 90 dakikada galibiyet gelirse EVET. Kaynak: UEFA.', 'YES if Türkiye wins at least one of the four Nations League matches between 25 Sep and 5 Oct 2026. Source: UEFA.',
   'sports','turkey',0.58,70000,'2026-10-05T21:00:00Z',NULL),
  ('Galatasaray 2026 sonunda Süper Lig lideri olur mu?', 'Will Galatasaray top the Süper Lig at the end of 2026?',
   '31 Aralık 2026 itibarıyla resmi TFF puan durumunda 1. sıradaysa EVET. Kaynak: TFF.', 'YES if Galatasaray is 1st in the official TFF standings on 31 Dec 2026.',
   'sports','turkey',0.61,120000,'2026-12-31T20:59:00Z',NULL),
  ('Beşiktaş 2026 sonunda ilk 2''de olur mu?', 'Will Beşiktaş be in the top 2 at the end of 2026?',
   '31 Aralık 2026 TFF puan durumunda 1. veya 2. sıradaysa EVET.', 'YES if Beşiktaş is 1st or 2nd in the TFF table on 31 Dec 2026.',
   'sports','turkey',0.44,60000,'2026-12-31T20:59:00Z',NULL),
  ('Fenerbahçe 2026 sonuna kadar teknik direktör değiştirir mi?', 'Will Fenerbahçe change head coach before the end of 2026?',
   '31 Aralık 2026''ye kadar kulüp resmi olarak teknik direktör ayrılığı/ataması duyurursa EVET. Kaynak: fenerbahce.org.', 'YES if Fenerbahçe officially announces a head coach departure or appointment by 31 Dec 2026.',
   'sports','turkey',0.38,85000,'2026-12-31T20:59:00Z','hot'),
  ('Galatasaray Şampiyonlar Ligi lig aşamasını ilk 24''te bitirir mi?', 'Will Galatasaray finish the Champions League league phase in the top 24?',
   '2026-27 UEFA Şampiyonlar Ligi lig aşaması son maç günü (Ocak 2027) sonunda ilk 24''teyse (play-off veya doğrudan son 16) EVET. Kaynak: UEFA.', 'YES if Galatasaray finishes the 2026-27 UCL league phase in the top 24 (play-off or direct round of 16). Source: UEFA.',
   'sports','turkey',0.55,95000,'2027-01-28T22:00:00Z',NULL),
  ('Fenerbahçe Şampiyonlar Ligi lig aşamasında en az 3 galibiyet alır mı?', 'Will Fenerbahçe win at least 3 league-phase Champions League matches?',
   '2026-27 UCL lig aşamasında (8 maç) en az 3 galibiyet alırsa EVET. Kaynak: UEFA.', 'YES if Fenerbahçe records at least 3 wins in the 8-match UCL league phase. Source: UEFA.',
   'sports','turkey',0.47,80000,'2027-01-28T22:00:00Z',NULL),
  ('Osimhen Ekim 2026''de Süper Lig''de en az 3 gol atar mı?', 'Will Osimhen score at least 3 Süper Lig goals in October 2026?',
   '1-31 Ekim 2026 arasındaki Süper Lig maçlarında en az 3 gol atarsa EVET. Kupa ve Avrupa maçları sayılmaz. Kaynak: TFF.', 'YES if Osimhen scores 3+ Süper Lig goals between 1 and 31 Oct 2026 (league only). Source: TFF.',
   'sports','turkey',0.49,55000,'2026-10-31T20:59:00Z',NULL),
  ('Filenin Sultanları 2026 FIVB Dünya Şampiyonası''nda madalya alır mı?', 'Will Türkiye women''s volleyball win a medal at the 2026 World Championship?',
   '2026 FIVB Kadınlar Dünya Şampiyonası''nda altın, gümüş veya bronz madalya alırsa EVET. Kaynak: FIVB.', 'YES if Türkiye wins gold, silver or bronze at the 2026 FIVB Women''s World Championship. Source: FIVB.',
   'sports','turkey',0.57,75000,'2026-10-03T21:00:00Z','trending'),
  ('Süper Lig''de 2026 bitmeden bir hakem VAR skandalı nedeniyle sezon boyu men edilir mi?', 'Will a Süper Lig referee be suspended for the rest of the season before 2027?',
   '31 Aralık 2026''ye kadar MHK/TFF bir hakemi sezonun kalanı için görevden alırsa EVET. Kaynak: TFF resmi açıklama.', 'YES if TFF/MHK removes a referee for the remainder of the season by 31 Dec 2026.',
   'sports','turkey',0.22,40000,'2026-12-31T20:59:00Z',NULL),

  -- ---------- EKONOMİ ----------
  ('TCMB Ekim toplantısında faizi %37''nin altına indirir mi?', 'Will the TCMB cut the policy rate below 37% at the October meeting?',
   'Ekim 2026 PPK toplantısında bir hafta vadeli repo faizi %37''nin altına çekilirse EVET. Kaynak: tcmb.gov.tr.', 'YES if the one-week repo rate is set below 37% at the October 2026 MPC meeting. Source: tcmb.gov.tr.',
   'economy','turkey',0.41,150000,'2026-10-23T12:00:00Z','hot'),
  ('Dolar/TL 31 Ekim''den önce 50''yi görür mü?', 'Will USD/TRY touch 50 before 31 October?',
   'TCMB gösterge kuru (döviz satış) herhangi bir iş gününde 50,00 veya üzerinde açıklanırsa EVET. Kaynak: tcmb.gov.tr.', 'YES if the TCMB indicative USD selling rate prints 50.00 or above on any business day before 31 Oct 2026.',
   'economy','turkey',0.33,200000,'2026-10-31T20:59:00Z','trending'),
  ('Eylül enflasyonu (aylık TÜFE) %2''nin üzerinde gelir mi?', 'Will September monthly CPI come in above 2%?',
   'TÜİK''in 3 Ekim 2026''da açıklayacağı Eylül aylık TÜFE %2,00''ın üzerindeyse EVET. Kaynak: tuik.gov.tr.', 'YES if TurkStat''s September 2026 monthly CPI (announced 3 Oct) is above 2.00%.',
   'economy','turkey',0.46,110000,'2026-10-03T08:00:00Z',NULL),
  ('BIST 100 Kasım sonuna kadar 15.000 puanı kapanışta geçer mi?', 'Will BIST 100 close above 15,000 by the end of November?',
   '30 Kasım 2026''ye kadar herhangi bir günlük kapanış 15.000 puanın üzerindeyse EVET. Kaynak: Borsa İstanbul.', 'YES if any daily close is above 15,000 by 30 Nov 2026. Source: Borsa İstanbul.',
   'economy','turkey',0.48,130000,'2026-11-30T20:59:00Z',NULL),
  ('Gram altın 2026 bitmeden 7.500 TL''yi geçer mi?', 'Will gram gold exceed 7,500 TL before the end of 2026?',
   'Kapalıçarşı gram altın satış fiyatı herhangi bir gün 7.500 TL veya üzeriyse EVET. Kaynak: Bloomberg HT / Kapalıçarşı.', 'YES if the Grand Bazaar gram gold selling price reaches 7,500 TL on any day before 31 Dec 2026.',
   'economy','turkey',0.42,95000,'2026-12-31T20:59:00Z',NULL),
  ('2027 asgari ücret zammı %30''un üzerinde olur mu?', 'Will the 2027 minimum wage increase exceed 30%?',
   'Resmi Gazete''de yayımlanan 2027 net asgari ücret, 2026 net asgari ücrete göre %30''dan fazla artmışsa EVET.', 'YES if the 2027 net minimum wage published in the Official Gazette is more than 30% above the 2026 figure.',
   'economy','turkey',0.35,140000,'2026-12-31T20:59:00Z','hot'),
  ('SSK-Bağ-Kur emeklisi Ocak 2027 zammı %10''un üzerinde olur mu?', 'Will the January 2027 pension increase for SSK/Bağ-Kur retirees exceed 10%?',
   'Ocak 2027''de uygulanacak 6 aylık enflasyon farkı zammı (TÜİK Aralık verisiyle kesinleşir) %10''un üzerindeyse EVET.', 'YES if the January 2027 six-month inflation adjustment for SSK/Bağ-Kur pensions exceeds 10%.',
   'economy','turkey',0.31,80000,'2027-01-05T08:00:00Z',NULL),
  ('Fed Aralık 2026 toplantısında faiz indirir mi?', 'Will the Fed cut rates at the December 2026 meeting?',
   'FOMC Aralık 2026 toplantısında federal fon faizi hedef aralığını düşürürse EVET. Kaynak: federalreserve.gov.', 'YES if the FOMC lowers the target range at its December 2026 meeting.',
   'economy','global',0.50,120000,'2026-12-16T20:00:00Z',NULL),
  ('Türkiye''nin kredi notu 2026 bitmeden üç büyük kuruluştan birince yükseltilir mi?', 'Will one of the big three agencies upgrade Türkiye before the end of 2026?',
   'S&P, Moody''s veya Fitch 31 Aralık 2026''ye kadar Türkiye''nin uzun vadeli notunu yükseltirse EVET. Görünüm değişikliği sayılmaz.', 'YES if S&P, Moody''s or Fitch upgrades Türkiye''s long-term rating by 31 Dec 2026 (outlook changes don''t count).',
   'economy','turkey',0.36,70000,'2026-12-31T20:59:00Z',NULL),

  -- ---------- SİYASET ----------
  ('2026 bitmeden Meclis erken seçim kararı alır mı?', 'Will Parliament call an early election before the end of 2026?',
   'TBMM 31 Aralık 2026''ye kadar seçimlerin yenilenmesi kararı alırsa EVET. Kaynak: TBMM / Resmi Gazete.', 'YES if the Grand National Assembly votes to renew elections by 31 Dec 2026.',
   'politics','turkey',0.12,160000,'2026-12-31T20:59:00Z','hot'),
  ('Ekrem İmamoğlu 2026 bitmeden tahliye edilir mi?', 'Will Ekrem İmamoğlu be released from detention before the end of 2026?',
   '31 Aralık 2026''ye kadar mahkeme tahliye kararı verir ve İmamoğlu cezaevinden çıkarsa EVET.', 'YES if a court orders İmamoğlu''s release and he leaves prison by 31 Dec 2026.',
   'politics','turkey',0.18,220000,'2026-12-31T20:59:00Z','trending'),
  ('CHP 2026 bitmeden yeni bir kurultay toplar mı?', 'Will the CHP hold a new party congress before the end of 2026?',
   '31 Aralık 2026''ye kadar CHP olağan veya olağanüstü kurultay toplarsa EVET. Kaynak: chp.org.tr / YSK.', 'YES if the CHP convenes an ordinary or extraordinary congress by 31 Dec 2026.',
   'politics','turkey',0.40,90000,'2026-12-31T20:59:00Z',NULL),
  ('Kabinede 2026 bitmeden bir bakan değişikliği olur mu?', 'Will there be a cabinet change before the end of 2026?',
   'Resmi Gazete''de 31 Aralık 2026''ye kadar en az bir bakanın görevden alınması veya yeni bakan ataması yayımlanırsa EVET.', 'YES if the Official Gazette publishes at least one minister''s dismissal or appointment by 31 Dec 2026.',
   'politics','turkey',0.34,60000,'2026-12-31T20:59:00Z',NULL),
  ('Türkiye-AB liderler zirvesi 2026 bitmeden yapılır mı?', 'Will a Türkiye-EU leaders summit take place before the end of 2026?',
   'Cumhurbaşkanı ile AB Konseyi/Komisyon Başkanı arasında resmi olarak "zirve" olarak duyurulan bir toplantı 31 Aralık 2026''ye kadar yapılırsa EVET.', 'YES if an officially announced Türkiye-EU summit between the President and EU Council/Commission leadership takes place by 31 Dec 2026.',
   'politics','turkey',0.20,35000,'2026-12-31T20:59:00Z',NULL),

  -- ---------- TEKNOLOJİ ----------
  ('Bitcoin Kasım sonuna kadar 90.000 doları görür mü?', 'Will Bitcoin touch $90,000 by the end of November?',
   'CoinGecko günlük en yüksek fiyatı 30 Kasım 2026''ye kadar 90.000 $ veya üzeriyse EVET.', 'YES if CoinGecko''s daily high reaches $90,000 or more by 30 Nov 2026.',
   'tech','global',0.31,250000,'2026-11-30T20:59:00Z','hot'),
  ('Bitcoin Ekim sonunda 70.000 doların altında kapanır mı?', 'Will Bitcoin close October below $70,000?',
   '31 Ekim 2026 CoinGecko UTC kapanışı 70.000 $''ın altındaysa EVET.', 'YES if the 31 Oct 2026 CoinGecko UTC close is below $70,000.',
   'tech','global',0.30,140000,'2026-10-31T23:59:00Z',NULL),
  ('iPhone 18''in Türkiye fiyatı 2026 bitmeden zamlanır mı?', 'Will iPhone 18 get a price hike in Türkiye before the end of 2026?',
   'apple.com/tr''de iPhone 18 128 GB liste fiyatı 82.999 TL''nin üzerine çıkarsa EVET.', 'YES if the apple.com/tr list price of iPhone 18 128 GB rises above 82,999 TL by 31 Dec 2026.',
   'tech','turkey',0.45,70000,'2026-12-31T20:59:00Z',NULL),
  ('Togg 2026 bitmeden Avrupa''da (Almanya) teslimata başlar mı?', 'Will Togg start deliveries in Germany before the end of 2026?',
   'Togg resmi kanalları 31 Aralık 2026''ye kadar Almanya''da müşteri teslimatlarının başladığını duyurursa EVET.', 'YES if Togg officially announces customer deliveries in Germany by 31 Dec 2026.',
   'tech','turkey',0.40,50000,'2026-12-31T20:59:00Z',NULL),
  ('Türkiye''den yeni bir unicorn 2026 bitmeden duyurulur mu?', 'Will a new Turkish unicorn be announced before the end of 2026?',
   'Türkiye merkezli veya Türk kurucuların şirketi 1 milyar $ ve üzeri değerlemeyle yatırım turu duyurursa EVET. Kaynak: Webrazzi / şirket açıklaması.', 'YES if a Turkey-based or Turkish-founded startup announces a funding round at a $1B+ valuation by 31 Dec 2026.',
   'tech','turkey',0.28,45000,'2026-12-31T20:59:00Z',NULL),
  ('OpenAI veya Google 2026 bitmeden Türkçe odaklı resmi bir ürün/özellik duyurur mu?', 'Will OpenAI or Google announce a Türkiye-specific product before the end of 2026?',
   'OpenAI veya Google, Türkiye pazarına özel ofis, ürün ya da Türkçe odaklı model duyurusu yaparsa EVET. Genel çok dilli güncellemeler sayılmaz.', 'YES if OpenAI or Google announces a Türkiye office, product or Turkish-focused model by 31 Dec 2026 (generic multilingual updates don''t count).',
   'tech','turkey',0.25,35000,'2026-12-31T20:59:00Z',NULL),

  -- ---------- EĞLENCE ----------
  ('Netflix "Seni Tanıyorum" Türkiye Top 10''da 3 hafta üst üste 1. olur mu?', 'Will Netflix''s "Seni Tanıyorum" top the Türkiye Top 10 for 3 straight weeks?',
   'Netflix Tudum haftalık Türkiye Top 10 (diziler) listesinde 3 ardışık hafta 1. sıradaysa EVET. Son tarih: 31 Ekim 2026.', 'YES if the series is #1 on Netflix''s weekly Türkiye Top 10 for 3 consecutive weeks by 31 Oct 2026. Source: Tudum.',
   'entertainment','turkey',0.35,40000,'2026-10-31T20:59:00Z',NULL),
  ('Bir Türk filmi 2026''da 5 milyon seyirciyi geçer mi?', 'Will a Turkish film pass 5 million admissions in 2026?',
   'Box Office Türkiye verilerine göre 2026 vizyon tarihli bir yerli film 31 Aralık 2026''ye kadar 5.000.000 seyirciyi geçerse EVET.', 'YES if a 2026-released Turkish film passes 5,000,000 admissions by 31 Dec 2026 per Box Office Türkiye.',
   'entertainment','turkey',0.30,60000,'2026-12-31T20:59:00Z',NULL),
  ('MasterChef Türkiye 2026 finalini bir kadın yarışmacı kazanır mı?', 'Will a woman win MasterChef Türkiye 2026?',
   'TV8''de yayımlanan 2026 sezonu finalinde şampiyon kadın yarışmacıysa EVET.', 'YES if the 2026 season champion on TV8 is a woman.',
   'entertainment','turkey',0.48,55000,'2026-12-31T20:59:00Z','trending'),
  ('Tarkan 2026 bitmeden yeni şarkı yayınlar mı?', 'Will Tarkan release a new song before the end of 2026?',
   'Spotify veya YouTube''da Tarkan adına yeni bir resmi single/albüm 31 Aralık 2026''ye kadar yayımlanırsa EVET. Remix ve canlı kayıtlar sayılmaz.', 'YES if an official new Tarkan single or album is released on Spotify/YouTube by 31 Dec 2026 (remixes and live recordings excluded).',
   'entertainment','turkey',0.40,30000,'2026-12-31T20:59:00Z',NULL),

  -- ---------- HAVA ----------
  ('İstanbul''a 2026 bitmeden kar yağar mı?', 'Will it snow in Istanbul before the end of 2026?',
   'MGM İstanbul (Kartal, Sarıyer, Florya veya Bahçeköy istasyonlarından herhangi biri) 31 Aralık 2026''ye kadar kar yağışı kaydederse EVET.', 'YES if any MGM Istanbul station records snowfall by 31 Dec 2026.',
   'weather','turkey',0.38,85000,'2026-12-31T20:59:00Z','hot'),
  ('Ekim 2026''da İstanbul''da sel/su baskını için turuncu veya kırmızı uyarı verilir mi?', 'Will Istanbul get an orange or red flood warning in October 2026?',
   'MGM 1-31 Ekim 2026 arasında İstanbul için turuncu veya kırmızı kodlu meteorolojik uyarı yayımlarsa EVET. Kaynak: mgm.gov.tr/meteouyari.', 'YES if MGM issues an orange or red warning for Istanbul between 1 and 31 Oct 2026.',
   'weather','turkey',0.33,40000,'2026-10-31T20:59:00Z',NULL),
  ('Antalya Ekim 2026''da 35°C''yi görür mü?', 'Will Antalya hit 35°C in October 2026?',
   'MGM Antalya merkez istasyonu 1-31 Ekim 2026 arasında en az bir gün 35,0°C veya üzeri ölçerse EVET.', 'YES if the MGM Antalya central station records 35.0°C or higher on any day in Oct 2026.',
   'weather','turkey',0.36,25000,'2026-10-31T20:59:00Z',NULL),

  -- ---------- DÜNYA ----------
  ('2026 Nobel Barış Ödülü bir kadına veya kadın liderli kuruluşa gider mi?', 'Will the 2026 Nobel Peace Prize go to a woman or a woman-led organisation?',
   'Norveç Nobel Komitesi''nin Ekim 2026 duyurusunda ödül bir kadına ya da kadın liderliğindeki bir kuruluşa verilirse EVET.', 'YES if the October 2026 announcement names a woman or a woman-led organisation.',
   'world','global',0.35,45000,'2026-10-09T12:00:00Z',NULL)
)
INSERT INTO markets (title_tr, title_en, description_tr, description_en, category, region, yes_prob, yes_pool, no_pool, total_volume, participant_count, ends_at, tag, status, kind)
SELECT
  s.title_tr, s.title_en, s.description_tr, s.description_en, s.category, s.region,
  s.yes_prob,
  FLOOR(s.volume * s.yes_prob)::int,
  (s.volume - FLOOR(s.volume * s.yes_prob))::int,
  s.volume,
  GREATEST(10, FLOOR(s.volume / 180))::int,
  s.ends_at::timestamptz,
  s.tag,
  'active', 'binary'
FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM markets m WHERE m.title_tr = s.title_tr);

-- Grafik için başlangıç noktası (son 10 dakikada eklenen marketler)
INSERT INTO market_prob_history (market_id, yes_prob)
SELECT id, yes_prob FROM markets
WHERE created_at > NOW() - INTERVAL '10 minutes'
  AND NOT EXISTS (SELECT 1 FROM market_prob_history h WHERE h.market_id = markets.id);

SELECT COUNT(*) AS acik_market FROM markets WHERE status = 'active' AND ends_at > NOW();
