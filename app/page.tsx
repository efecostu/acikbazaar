import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MarketCard } from '@/components/MarketCard';
import { LangProvider } from '@/contexts/LangContext';
import type { Market } from '@/types';

export const dynamic = 'force-dynamic';

const DEMO_MARKETS: Market[] = [
  {
    id: '1', title_en: 'Will TCMB cut rates before end of Q3 2025?', title_tr: 'TCMB 2025 Q3 sonuna kadar faiz indirir mi?',
    description_en: null, description_tr: null, category: 'economy', region: 'turkey',
    yes_prob: 0.67, yes_pool: 48200, no_pool: 23800, total_volume: 72000, participant_count: 312,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 130 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '2', title_en: 'Will USD/TRY exceed 40 before July 2025?', title_tr: 'USD/TRY Temmuz 2025\'ten önce 40\'ı geçer mi?',
    description_en: null, description_tr: null, category: 'economy', region: 'turkey',
    yes_prob: 0.44, yes_pool: 27000, no_pool: 34500, total_volume: 61500, participant_count: 489,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 50 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '3', title_en: 'Will CHP win Istanbul mayoral election in 2025?', title_tr: 'CHP 2025 İstanbul Büyükşehir seçimini kazanır mı?',
    description_en: null, description_tr: null, category: 'politics', region: 'turkey',
    yes_prob: 0.72, yes_pool: 67000, no_pool: 26400, total_volume: 93400, participant_count: 741,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 200 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '4', title_en: 'Will Fenerbahçe win the Süper Lig title 2024-25?', title_tr: 'Fenerbahçe 2024-25 Süper Lig şampiyonu olur mu?',
    description_en: null, description_tr: null, category: 'sports', region: 'turkey',
    yes_prob: 0.51, yes_pool: 17700, no_pool: 17100, total_volume: 34800, participant_count: 628,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 5 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
  },
  {
    id: '5', title_en: 'Will the Fed cut rates in June 2025?', title_tr: 'Fed Haziran 2025\'te faiz indirir mi?',
    description_en: null, description_tr: null, category: 'economy', region: 'global',
    yes_prob: 0.38, yes_pool: 83000, no_pool: 135000, total_volume: 218000, participant_count: 1842,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 28 * 864e5).toISOString(), tag: 'hot', created_at: new Date().toISOString(),
  },
  {
    id: '6', title_en: 'Will OpenAI release GPT-5 before August 2025?', title_tr: 'OpenAI GPT-5\'i Ağustos 2025 öncesinde yayınlar mı?',
    description_en: null, description_tr: null, category: 'tech', region: 'global',
    yes_prob: 0.61, yes_pool: 53000, no_pool: 34300, total_volume: 87300, participant_count: 934,
    status: 'active', outcome: null, ends_at: new Date(Date.now() + 70 * 864e5).toISOString(), tag: null, created_at: new Date().toISOString(),
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
              { val: '◈2.4M', label: 'İşlem hacmi' },
              { val: '%100', label: 'Ücretsiz' },
              { val: '5+', label: 'Kategori' },
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
