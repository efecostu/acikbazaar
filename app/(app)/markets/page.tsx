import { MarketsClient } from './MarketsClient';
import type { Market } from '@/types';

export const revalidate = 30;

const DEMO_MARKETS: Market[] = [
  {
    id: '1', title_en: 'Will USD/TRY exceed 40 before October 2025?', title_tr: 'USD/TRY Ekim 2025\'den önce 40\'ı geçer mi?',
    description_en: 'Tracking the Turkish lira against the US dollar based on TCMB official rates.',
    description_tr: 'TCMB resmi kuruna göre takip edilmektedir.',
    category: 'economy', region: 'turkey', yes_prob: 0.62, yes_pool: 6200, no_pool: 3800,
    total_volume: 10000, participant_count: 148, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '2', title_en: 'Will Galatasaray win the 2024-25 Süper Lig?', title_tr: 'Galatasaray 2024-25 Süper Lig\'i şampiyon bitirir mi?',
    description_en: 'Galatasaray is the defending champion. Final standings determine the outcome.',
    description_tr: 'Sezon sonu puan tablosu esas alınır.',
    category: 'sports', region: 'turkey', yes_prob: 0.74, yes_pool: 14800, no_pool: 5200,
    total_volume: 20000, participant_count: 382, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), tag: 'trending', created_at: new Date().toISOString(),
  },
  {
    id: '3', title_en: 'Will the Fed cut rates at least once before December 2025?', title_tr: 'Fed Aralık 2025\'ten önce en az bir faiz indirimi yapar mı?',
    description_en: 'Based on FOMC meeting decisions. A 25bps cut counts as YES.',
    description_tr: 'FOMC toplantı kararlarına göre. 25 baz puanlık indirim YES sayılır.',
    category: 'economy', region: 'global', yes_prob: 0.55, yes_pool: 5500, no_pool: 4500,
    total_volume: 10000, participant_count: 221, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '4', title_en: 'Will Bitcoin reach $120k before 2026?', title_tr: 'Bitcoin 2026 öncesinde 120.000$\'a ulaşır mı?',
    description_en: 'Spot BTC price on major exchanges. CoinGecko 24h average.',
    description_tr: 'Büyük borsalardaki spot BTC fiyatı. CoinGecko 24 saatlik ortalaması.',
    category: 'tech', region: 'global', yes_prob: 0.48, yes_pool: 9600, no_pool: 10400,
    total_volume: 20000, participant_count: 413, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '5', title_en: 'Will a new Turkish unicorn emerge in 2025?', title_tr: '2025\'te yeni bir Türk unicorn\'u ortaya çıkar mı?',
    description_en: 'A Turkish-founded startup reaching $1B+ valuation in 2025.',
    description_tr: '2025\'te 1 milyar dolar değerlemeye ulaşan Türkiye kökenli startup.',
    category: 'tech', region: 'turkey', yes_prob: 0.35, yes_pool: 3500, no_pool: 6500,
    total_volume: 10000, participant_count: 170, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '6', title_en: 'Will Erdoğan attend the UN General Assembly 2025?', title_tr: 'Erdoğan 2025 BM Genel Kurulu\'na katılır mı?',
    description_en: 'Based on official Turkish government announcements.',
    description_tr: 'Türk hükümetinin resmi açıklamalarına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.81, yes_pool: 8100, no_pool: 1900,
    total_volume: 10000, participant_count: 95, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '7', title_en: 'Will OpenAI release GPT-5 before July 2025?', title_tr: 'OpenAI GPT-5\'i Temmuz 2025\'ten önce yayınlar mı?',
    description_en: 'Official OpenAI announcement counts. API access qualifies.',
    description_tr: 'Resmi OpenAI duyurusu veya API erişimi esas alınır.',
    category: 'tech', region: 'global', yes_prob: 0.67, yes_pool: 6700, no_pool: 3300,
    total_volume: 10000, participant_count: 311, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '8', title_en: 'Will BIST 100 close above 12,000 in Q3 2025?', title_tr: 'BIST 100, 2025 Q3\'te 12.000\'in üzerinde kapanır mı?',
    description_en: 'Based on official Borsa Istanbul closing data.',
    description_tr: 'Borsa İstanbul resmi kapanış verilerine göre.',
    category: 'economy', region: 'turkey', yes_prob: 0.53, yes_pool: 5300, no_pool: 4700,
    total_volume: 10000, participant_count: 134, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '9', title_en: 'Will the 2026 FIFA World Cup qualifying round feature a Turkish surprise?', title_tr: '2026 FIFA Dünya Kupası elemeleri Türkiye sürprizi getirir mi?',
    description_en: 'Turkey finishing top of their qualifying group.',
    description_tr: 'Türkiye\'nin eleme grubunu lider tamamlaması.',
    category: 'sports', region: 'turkey', yes_prob: 0.44, yes_pool: 4400, no_pool: 5600,
    total_volume: 10000, participant_count: 89, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
];

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default async function MarketsPage() {
  if (DEMO_MODE) {
    return <MarketsClient markets={DEMO_MARKETS} />;
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: markets } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return <MarketsClient markets={markets ?? []} />;
}
