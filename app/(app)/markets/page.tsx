import { MarketsClient } from './MarketsClient';
import type { Market } from '@/types';

export const revalidate = 30;

// Gerçekçi simüle havuzlar: favori taraf daha büyük
function pools(prob: number, volume: number, participants: number) {
  return {
    yes_pool: Math.floor(volume * prob),
    no_pool: Math.floor(volume * (1 - prob)),
    total_volume: volume,
    participant_count: participants,
  };
}

const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

export const DEMO_MARKETS: Market[] = [
  // SPOR
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000001',
    title_en: 'Will Galatasaray win the 2026-27 Süper Lig?',
    title_tr: 'Galatasaray 2026-27 Süper Ligi şampiyon bitirir mi?',
    description_en: 'Based on final Süper Lig standings.', description_tr: 'Sezon sonu puan tablosuna göre.',
    category: 'sports', region: 'turkey', yes_prob: 0.74, tag: 'trending', status: 'active', outcome: null,
    ends_at: d(61), created_at: new Date().toISOString(),
    ...pools(0.74, 87400, 741),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000002',
    title_en: 'Will Fenerbahçe qualify for Champions League 2026-27?',
    title_tr: 'Fenerbahçe 2026-27 sezonunda Şampiyonlar Ligi\'ne kalır mı?',
    description_en: null, description_tr: null,
    category: 'sports', region: 'turkey', yes_prob: 0.51, tag: null, status: 'active', outcome: null,
    ends_at: d(5), created_at: new Date().toISOString(),
    ...pools(0.51, 34800, 628),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000003',
    title_en: 'Will Turkey qualify top of their 2026 World Cup group?',
    title_tr: 'Türkiye 2026 Dünya Kupası elemelerinde grup birincisi olur mu?',
    description_en: null, description_tr: null,
    category: 'sports', region: 'turkey', yes_prob: 0.58, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(180), created_at: new Date().toISOString(),
    ...pools(0.58, 52000, 490),
  },
  // EKONOMİ
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000004',
    title_en: 'Will TCMB cut rates before end of Q3 2026?',
    title_tr: 'TCMB 2026 Q3 sonuna kadar faiz indirir mi?',
    description_en: 'At least 25bps cut counts as YES.', description_tr: 'En az 25 baz puanlık indirim EVET sayılır.',
    category: 'economy', region: 'turkey', yes_prob: 0.67, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(130), created_at: new Date().toISOString(),
    ...pools(0.67, 72000, 312),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000005',
    title_en: 'Will USD/TRY exceed 40 before October 2026?',
    title_tr: 'USD/TRY Ekim 2026\'ten önce 40\'ı geçer mi?',
    description_en: 'Based on TCMB official rates.', description_tr: 'TCMB resmi kuruna göre.',
    category: 'economy', region: 'turkey', yes_prob: 0.44, tag: null, status: 'active', outcome: null,
    ends_at: d(123), created_at: new Date().toISOString(),
    ...pools(0.44, 61500, 489),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000006',
    title_en: 'Will the Fed cut rates at least once before December 2026?',
    title_tr: 'Fed Aralık 2026\'ten önce en az bir faiz indirimi yapar mı?',
    description_en: 'Based on FOMC decisions.', description_tr: 'FOMC kararlarına göre.',
    category: 'economy', region: 'global', yes_prob: 0.55, tag: null, status: 'active', outcome: null,
    ends_at: d(184), created_at: new Date().toISOString(),
    ...pools(0.55, 218000, 1842),
  },
  // TEKNOLOJİ
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000007',
    title_en: 'Will OpenAI release GPT-5 before August 2026?',
    title_tr: 'OpenAI GPT-5\'i Ağustos 2026 öncesinde yayınlar mı?',
    description_en: null, description_tr: null,
    category: 'tech', region: 'global', yes_prob: 0.61, tag: null, status: 'active', outcome: null,
    ends_at: d(70), created_at: new Date().toISOString(),
    ...pools(0.61, 87300, 934),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000008',
    title_en: 'Will Bitcoin hit $120K before 2027?',
    title_tr: 'Bitcoin 2027 öncesinde 120.000$\'a ulaşır mı?',
    description_en: 'CoinGecko 24h average.', description_tr: 'CoinGecko 24 saatlik ortalama.',
    category: 'tech', region: 'global', yes_prob: 0.48, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(153), created_at: new Date().toISOString(),
    ...pools(0.48, 312000, 2341),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000009',
    title_en: 'Will a new Turkish unicorn emerge in 2026?',
    title_tr: '2026\'te yeni bir Türk unicorn\'u ortaya çıkar mı?',
    description_en: null, description_tr: null,
    category: 'tech', region: 'turkey', yes_prob: 0.35, tag: null, status: 'active', outcome: null,
    ends_at: d(184), created_at: new Date().toISOString(),
    ...pools(0.35, 10000, 170),
  },
  // SİYASET
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000010',
    title_en: 'Will CHP win Istanbul mayoral election in 2026?',
    title_tr: 'CHP 2026 İstanbul Büyükşehir seçimini kazanır mı?',
    description_en: 'Based on official YSK results.', description_tr: 'YSK resmi sonuçlarına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.72, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(200), created_at: new Date().toISOString(),
    ...pools(0.72, 93400, 741),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000011',
    title_en: 'Will EU restart Turkey accession talks in 2026?',
    title_tr: 'AB 2026\'te Türkiye ile katılım müzakerelerine yeniden başlar mı?',
    description_en: null, description_tr: null,
    category: 'politics', region: 'turkey', yes_prob: 0.12, tag: null, status: 'active', outcome: null,
    ends_at: d(210), created_at: new Date().toISOString(),
    ...pools(0.12, 8900, 76),
  },
  // EĞLENCE
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000012',
    title_en: 'Will a Turkish series win an international Emmy in 2026?',
    title_tr: 'Bir Türk dizisi 2026\'te uluslararası Emmy kazanır mı?',
    description_en: 'International Emmy Awards 2026 ceremony.', description_tr: 'Uluslararası Emmy Ödülleri 2026 töreni.',
    category: 'entertainment', region: 'turkey', yes_prob: 0.42, tag: null, status: 'active', outcome: null,
    ends_at: d(190), created_at: new Date().toISOString(),
    ...pools(0.42, 28000, 390),
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000013',
    title_en: 'Will Tarkan release a new album or single in 2026?',
    title_tr: 'Tarkan 2026 yılında yeni albüm veya single çıkarır mı?',
    description_en: 'Official music release on major platforms.', description_tr: 'Büyük platformlarda resmi müzik yayını.',
    category: 'entertainment', region: 'turkey', yes_prob: 0.68, tag: '🔥', status: 'active', outcome: null,
    ends_at: d(220), created_at: new Date().toISOString(),
    ...pools(0.68, 19500, 281),
  },
  // HAVA DURUMU
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000014',
    title_en: 'Will Istanbul experience a flash flood warning in Summer 2026?',
    title_tr: 'İstanbul\'da 2026 yazında sel uyarısı verilir mi?',
    description_en: 'Based on official AFAD or meteorology warnings.', description_tr: 'AFAD veya meteoroloji resmi uyarısına göre.',
    category: 'weather', region: 'turkey', yes_prob: 0.79, tag: null, status: 'active', outcome: null,
    ends_at: d(100), created_at: new Date().toISOString(),
    ...pools(0.79, 14200, 188),
  },
];

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default async function MarketsPage() {
  if (DEMO_MODE) return <MarketsClient markets={DEMO_MARKETS} />;

  // Trafik bazlı bot aktivitesi: yanıt gönderildikten sonra tick'i dürt.
  // Endpoint kendi içinde throttle'lı (90 dk) — her sayfa yüklemesi bahis üretmez.
  const { after } = await import('next/server');
  after(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bots/tick`, {
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '' },
      });
    } catch { /* bot aktivitesi kritik değil */ }
  });

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: markets }, { data: profile }, { data: trades }] = await Promise.all([
    supabase
      .from('markets')
      .select('*, market_options(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    user
      ? supabase.from('profiles').select('interests').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('bets')
      .select('id, side, amount, created_at, profiles(username, is_bot), markets(id, title_tr, title_en)')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  return (
    <MarketsClient
      markets={markets ?? []}
      interests={profile?.interests ?? null}
      trades={(trades as never[]) ?? []}
    />
  );
}
