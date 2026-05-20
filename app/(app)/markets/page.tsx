import { MarketsClient } from './MarketsClient';
import type { Market } from '@/types';

export const revalidate = 30;

const DEMO_MARKETS: Market[] = [
  {
    id: '1', title_en: 'Will TCMB cut rates before end of Q3 2025?', title_tr: 'TCMB 2025 Q3 sonuna kadar faiz indirir mi?',
    description_en: 'Based on TCMB MPC meeting decisions. At least one 25bps cut counts as YES.', description_tr: 'TCMB PPK toplantı kararlarına göre. En az 25 baz puanlık indirim YES sayılır.',
    category: 'economy', region: 'turkey', yes_prob: 0.67, yes_pool: 48200, no_pool: 23800,
    total_volume: 72000, participant_count: 312, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 130 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '2', title_en: 'Will USD/TRY exceed 40 before July 2025?', title_tr: 'USD/TRY Temmuz 2025\'ten önce 40\'ı geçer mi?',
    description_en: 'Based on TCMB official exchange rates.', description_tr: 'TCMB resmi kur verilerine göre.',
    category: 'economy', region: 'turkey', yes_prob: 0.44, yes_pool: 27000, no_pool: 34500,
    total_volume: 61500, participant_count: 489, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 50 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '3', title_en: 'Will CHP win Istanbul mayoral election in 2025?', title_tr: 'CHP 2025 İBB seçimini kazanır mı?',
    description_en: 'Based on official YSK results.', description_tr: 'YSK resmi sonuçlarına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.72, yes_pool: 67000, no_pool: 26400,
    total_volume: 93400, participant_count: 741, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 200 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '4', title_en: 'Will Fenerbahçe win the Süper Lig title 2024-25?', title_tr: 'Fenerbahçe 2024-25 Süper Lig şampiyonu olur mu?',
    description_en: 'Based on final Süper Lig standings.', description_tr: 'Sezon sonu Süper Lig puan tablosuna göre.',
    category: 'sports', region: 'turkey', yes_prob: 0.51, yes_pool: 17700, no_pool: 17100,
    total_volume: 34800, participant_count: 628, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 5 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '5', title_en: 'Will the Fed cut rates in June 2025?', title_tr: 'Fed Haziran 2025\'te faiz indirir mi?',
    description_en: 'FOMC June meeting decision. A 25bps cut counts as YES.', description_tr: 'FOMC Haziran toplantısı. 25 baz puan indirim YES sayılır.',
    category: 'economy', region: 'global', yes_prob: 0.38, yes_pool: 83000, no_pool: 135000,
    total_volume: 218000, participant_count: 1842, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 28 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '6', title_en: 'Will OpenAI release GPT-5 before August 2025?', title_tr: 'OpenAI GPT-5\'i Ağustos 2025 öncesinde yayınlar mı?',
    description_en: 'Official OpenAI announcement or API access qualifies.', description_tr: 'Resmi OpenAI duyurusu veya API erişimi.',
    category: 'tech', region: 'global', yes_prob: 0.61, yes_pool: 53000, no_pool: 34300,
    total_volume: 87300, participant_count: 934, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 70 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '7', title_en: 'Will Bitcoin hit $120K before end of 2025?', title_tr: 'Bitcoin 2025 sonuna kadar 120.000$\'a ulaşır mı?',
    description_en: 'CoinGecko 24h average. Single-day close above $120K qualifies.', description_tr: 'CoinGecko 24 saatlik ortalama. Tek günlük 120K$ üzeri kapanış yeterlidir.',
    category: 'tech', region: 'global', yes_prob: 0.55, yes_pool: 171000, no_pool: 141000,
    total_volume: 312000, participant_count: 2341, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 220 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '8', title_en: 'Will Erdoğan attend G20 summit 2025?', title_tr: 'Erdoğan 2025 G20 zirvesine katılır mı?',
    description_en: 'Based on official Turkish government attendance at G20 South Africa 2025.', description_tr: 'Türk hükümetinin G20 Güney Afrika 2025\'e katılımına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.83, yes_pool: 10100, no_pool: 2000,
    total_volume: 12100, participant_count: 98, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 180 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '9', title_en: 'Will EU start Turkey accession talks again in 2025?', title_tr: 'AB 2025\'te Türkiye ile katılım müzakerelerine yeniden başlar mı?',
    description_en: 'Official EU Council decision to open new accession chapters with Turkey.', description_tr: 'AB Konseyi\'nin Türkiye ile yeni müzakere fasılları açma kararı.',
    category: 'politics', region: 'turkey', yes_prob: 0.12, yes_pool: 1100, no_pool: 7800,
    total_volume: 8900, participant_count: 76, status: 'active', outcome: null,
    ends_at: new Date(Date.now() + 210 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
];

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default async function MarketsPage() {
  if (DEMO_MODE) return <MarketsClient markets={DEMO_MARKETS} />;

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: markets } = await supabase
    .from('markets').select('*').eq('status', 'active').order('created_at', { ascending: false });

  return <MarketsClient markets={markets ?? []} />;
}
