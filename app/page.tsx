import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MarketCard } from '@/components/MarketCard';
import { LangProvider } from '@/contexts/LangContext';
import type { Market } from '@/types';

export const dynamic = 'force-dynamic';

const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

const DEMO_MARKETS: Market[] = [
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000001',
    title_en: 'Will Galatasaray win the 2024-25 Süper Lig?',
    title_tr: 'Galatasaray 2024-25 Süper Ligi şampiyon bitirir mi?',
    description_en: 'Based on final Süper Lig standings.', description_tr: 'Sezon sonu puan tablosuna göre.',
    category: 'sports', region: 'turkey', yes_prob: 0.74, tag: 'trending', status: 'active', outcome: null,
    ends_at: d(61), created_at: new Date().toISOString(),
    yes_pool: 64676, no_pool: 22724, total_volume: 87400, participant_count: 741,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000004',
    title_en: 'Will TCMB cut rates before end of Q3 2025?',
    title_tr: 'TCMB 2025 Q3 sonuna kadar faiz indirir mi?',
    description_en: 'At least 25bps cut counts as YES.', description_tr: 'En az 25 baz puanlık indirim EVET sayılır.',
    category: 'economy', region: 'turkey', yes_prob: 0.67, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(130), created_at: new Date().toISOString(),
    yes_pool: 48240, no_pool: 23760, total_volume: 72000, participant_count: 312,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000010',
    title_en: 'Will CHP win Istanbul mayoral election in 2025?',
    title_tr: 'CHP 2025 İstanbul Büyükşehir seçimini kazanır mı?',
    description_en: 'Based on official YSK results.', description_tr: 'YSK resmi sonuçlarına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.72, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(200), created_at: new Date().toISOString(),
    yes_pool: 67248, no_pool: 26152, total_volume: 93400, participant_count: 741,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000008',
    title_en: 'Will Bitcoin hit $120K before 2026?',
    title_tr: 'Bitcoin 2026 öncesinde 120.000$\'a ulaşır mı?',
    description_en: 'CoinGecko 24h average.', description_tr: 'CoinGecko 24 saatlik ortalama.',
    category: 'tech', region: 'global', yes_prob: 0.48, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(153), created_at: new Date().toISOString(),
    yes_pool: 149760, no_pool: 162240, total_volume: 312000, participant_count: 2341,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000013',
    title_en: 'Will Tarkan release a new album or single in 2025?',
    title_tr: 'Tarkan 2025 yılında yeni albüm veya single çıkarır mı?',
    description_en: 'Official music release on major platforms.', description_tr: 'Büyük platformlarda resmi müzik yayını.',
    category: 'entertainment', region: 'turkey', yes_prob: 0.68, tag: '🔥', status: 'active', outcome: null,
    ends_at: d(220), created_at: new Date().toISOString(),
    yes_pool: 13260, no_pool: 6240, total_volume: 19500, participant_count: 281,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000014',
    title_en: 'Will Istanbul experience a flash flood warning in Summer 2025?',
    title_tr: 'İstanbul\'da 2025 yazında sel uyarısı verilir mi?',
    description_en: 'Based on official AFAD or meteorology warnings.', description_tr: 'AFAD veya meteoroloji resmi uyarısına göre.',
    category: 'weather', region: 'turkey', yes_prob: 0.79, tag: null, status: 'active', outcome: null,
    ends_at: d(100), created_at: new Date().toISOString(),
    yes_pool: 11218, no_pool: 2982, total_volume: 14200, participant_count: 188,
  },
];

export default async function LandingPage() {
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

  if (!isDemoMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/markets');
  }

  return (
    <LangProvider>
      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-[#E5E7EB] bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A] font-bold text-lg">◈</span>
              <span className="text-sm font-bold text-[#111827]">AçıkBazaar</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors px-3 py-1.5">
                Giriş Yap
              </Link>
              <Link href="/register" className="bg-[#16A34A] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-[#15803D] transition-colors">
                Ücretsiz Başla
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 pt-16 pb-10">
          <div className="max-w-2xl mb-12">
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1 text-xs font-semibold text-[#16A34A] mb-5">
              ◈ Gerçek para yok — tamamen ücretsiz
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-[#111827] leading-tight tracking-tight mb-4">
              Gerçek hayat eventlerine<br />
              <span className="text-[#16A34A]">tahmin yap.</span>
            </h1>
            <p className="text-lg text-[#6B7280] leading-relaxed mb-8">
              Kalshi ve Polymarket&apos;ın ücretsiz simülasyon alternatifi.
              Sanal kredilerinle tahmin piyasasını öğren, toplulukla yarış.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/register" className="bg-[#16A34A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#15803D] transition-colors text-sm">
                Başla — ◈1,000 Kredi Ücretsiz
              </Link>
              <Link href="/login" className="border border-[#E5E7EB] text-[#374151] font-semibold px-6 py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors text-sm">
                Giriş Yap
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-8 py-6 border-y border-[#F3F4F6] mb-12">
            {[
              { val: '10K+', label: 'Aktif tahmin' },
              { val: '◈4.8M', label: 'İşlem hacmi' },
              { val: '%100', label: 'Ücretsiz' },
              { val: '7', label: 'Kategori' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-[#111827]">{s.val}</div>
                <div className="text-xs text-[#9CA3AF] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Live markets preview */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#111827]">Aktif Marketler</h2>
            <Link href="/register" className="text-sm font-medium text-[#16A34A] hover:underline">
              Tümünü gör →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_MARKETS.map((market) => (
              <MarketCard key={market.id} market={market} href="/register" />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-[#111827] mb-2">Tahmin yapmaya hazır mısın?</h3>
            <p className="text-sm text-[#6B7280] mb-5">Ücretsiz kayıt ol, ◈1,000 kredi kazan, anında başla.</p>
            <Link href="/register" className="inline-block bg-[#16A34A] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#15803D] transition-colors text-sm">
              Ücretsiz Hesap Aç
            </Link>
            <p className="text-xs text-[#9CA3AF] mt-3">Gerçek para içermez. Hiçbir zaman.</p>
          </div>
        </section>
      </div>
    </LangProvider>
  );
}
