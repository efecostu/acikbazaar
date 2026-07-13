import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarketCard } from '@/components/MarketCard';
import { HeroTicker } from '@/components/HeroTicker';
import DotField from '@/components/DotField';
import { LangProvider } from '@/contexts/LangContext';
import type { Market } from '@/types';

export const dynamic = 'force-dynamic';

const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

const DEMO_MARKETS: Market[] = [
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000001',
    title_en: 'Will Galatasaray win the 2026-27 Süper Lig?',
    title_tr: 'Galatasaray 2026-27 Süper Ligi şampiyon bitirir mi?',
    description_en: 'Based on final Süper Lig standings.', description_tr: 'Sezon sonu puan tablosuna göre.',
    category: 'sports', region: 'turkey', yes_prob: 0.74, tag: 'trending', status: 'active', outcome: null,
    ends_at: d(61), created_at: new Date().toISOString(),
    yes_pool: 64676, no_pool: 22724, total_volume: 87400, participant_count: 741,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000004',
    title_en: 'Will TCMB cut rates before end of Q3 2026?',
    title_tr: 'TCMB 2026 Q3 sonuna kadar faiz indirir mi?',
    description_en: 'At least 25bps cut counts as YES.', description_tr: 'En az 25 baz puanlık indirim EVET sayılır.',
    category: 'economy', region: 'turkey', yes_prob: 0.67, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(130), created_at: new Date().toISOString(),
    yes_pool: 48240, no_pool: 23760, total_volume: 72000, participant_count: 312,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000010',
    title_en: 'Will CHP win Istanbul mayoral election in 2026?',
    title_tr: 'CHP 2026 İstanbul Büyükşehir seçimini kazanır mı?',
    description_en: 'Based on official YSK results.', description_tr: 'YSK resmi sonuçlarına göre.',
    category: 'politics', region: 'turkey', yes_prob: 0.72, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(200), created_at: new Date().toISOString(),
    yes_pool: 67248, no_pool: 26152, total_volume: 93400, participant_count: 741,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000008',
    title_en: 'Will Bitcoin hit $120K before 2027?',
    title_tr: 'Bitcoin 2027 öncesinde 120.000$\'a ulaşır mı?',
    description_en: 'CoinGecko 24h average.', description_tr: 'CoinGecko 24 saatlik ortalama.',
    category: 'tech', region: 'global', yes_prob: 0.48, tag: 'hot', status: 'active', outcome: null,
    ends_at: d(153), created_at: new Date().toISOString(),
    yes_pool: 149760, no_pool: 162240, total_volume: 312000, participant_count: 2341,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000013',
    title_en: 'Will Tarkan release a new album or single in 2026?',
    title_tr: 'Tarkan 2026 yılında yeni albüm veya single çıkarır mı?',
    description_en: 'Official music release on major platforms.', description_tr: 'Büyük platformlarda resmi müzik yayını.',
    category: 'entertainment', region: 'turkey', yes_prob: 0.68, tag: '🔥', status: 'active', outcome: null,
    ends_at: d(220), created_at: new Date().toISOString(),
    yes_pool: 13260, no_pool: 6240, total_volume: 19500, participant_count: 281,
  },
  {
    id: 'f1a2b3c4-0001-0001-0001-000000000014',
    title_en: 'Will Istanbul experience a flash flood warning in Summer 2026?',
    title_tr: 'İstanbul\'da 2026 yazında sel uyarısı verilir mi?',
    description_en: 'Based on official AFAD or meteorology warnings.', description_tr: 'AFAD veya meteoroloji resmi uyarısına göre.',
    category: 'weather', region: 'turkey', yes_prob: 0.79, tag: null, status: 'active', outcome: null,
    ends_at: d(100), created_at: new Date().toISOString(),
    yes_pool: 11218, no_pool: 2982, total_volume: 14200, participant_count: 188,
  },
];

export default async function LandingPage() {
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

  let loggedIn = false;
  let markets: Market[] = DEMO_MARKETS;

  if (!isDemoMode) {
    const supabase = await createClient();
    const [{ data: { user } }, { data: liveMarkets }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('markets').select('*, market_options(*)').eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('total_volume', { ascending: false }).limit(6),
    ]);
    loggedIn = !!user;
    if (liveMarkets && liveMarkets.length > 0) markets = liveMarkets;
  }

  // Gerçek marketler varsa kartlar doğrudan detay sayfasına gider (marketler public);
  // demo fallback'te sahte ID'ler 404 vermesin diye listeye yönlendirilir
  const cardHref = markets === DEMO_MARKETS ? '/markets' : undefined;

  return (
    <LangProvider>
      <div className="min-h-screen bg-[var(--paper)]">
        {/* Nav */}
        <nav className="border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[var(--rise)] font-bold text-lg">◈</span>
              <span className="font-display text-[15px] font-bold text-[var(--ink)]">AçıkBazaar</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/markets" className="hidden sm:block text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
                Marketler
              </Link>
              {loggedIn && (
                <Link href="/portfolio" className="hidden sm:block text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
                  Portföy
                </Link>
              )}
              <Link href="/leaderboard" className="hidden sm:block text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
                Sıralama
              </Link>
              {loggedIn ? (
                <Link href="/markets" className="bg-[var(--rise)] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:brightness-110 transition-all">
                  Marketlere Git →
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors px-3 py-1.5">
                    Giriş Yap
                  </Link>
                  <Link href="/register" className="bg-[var(--rise)] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:brightness-110 transition-all">
                    Ücretsiz Başla
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <DotField
              dotRadius={1.4}
              dotSpacing={16}
              cursorRadius={220}
              bulgeStrength={46}
              glowRadius={140}
              sparkle
              gradientFrom="rgba(47, 213, 136, 0.30)"
              gradientTo="rgba(11, 160, 95, 0.14)"
              glowColor="#2FD588"
            />
            {/* Alt kenarda içerikle yumuşak kaynaşma */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--paper)]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-14">
          <div className="max-w-2xl">
            <div className="font-data text-[11px] tracking-[0.18em] uppercase text-[var(--rise)] mb-5">
              Türkiye&apos;nin tahmin pazarı
            </div>
            <h1 className="font-display text-[44px] sm:text-[58px] font-bold text-[var(--ink)] leading-[1.05] tracking-tight mb-5">
              Olacak mı,<br />olmayacak mı?
            </h1>
            <p className="text-lg text-[var(--ink-2)] leading-relaxed mb-5 max-w-xl">
              Faizden Süper Lig&apos;e, seçimden Bitcoin&apos;e — gerçek hayat sorularına
              EVET ya da HAYIR de. Gerçek para yok; ◈100.000 sanal krediyle başla,
              tahmin gücünle sıralamada yüksel.
            </p>
            <HeroTicker
              items={markets.slice(0, 6).map((m) => ({
                title: m.title_tr,
                yesPct: Math.round(
                  (m.yes_pool / Math.max(m.yes_pool + m.no_pool, 1)) * 100
                ),
              }))}
            />
            <div className="flex gap-3 flex-wrap">
              <Link href={loggedIn ? '/markets' : '/register'} className="bg-[var(--rise)] text-white font-semibold px-6 py-3 rounded-xl hover:brightness-110 transition-all text-sm">
                {loggedIn ? 'Marketlere göz at' : 'Tahmin etmeye başla'}
              </Link>
              {!loggedIn && (
                <Link href="/markets" className="border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] font-semibold px-6 py-3 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm">
                  Marketlere göz at
                </Link>
              )}
            </div>
          </div>
          </div>
        </section>

        {/* Stats bandı — beyaz şerit, üst/alt çizgili */}
        <div className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-7xl mx-auto px-4 flex gap-10 py-6 flex-wrap">
            {[
              { val: '10K+', label: 'Aktif tahmin' },
              { val: '◈4.8M', label: 'İşlem hacmi' },
              { val: '%100', label: 'Ücretsiz' },
              { val: '7', label: 'Kategori' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-data text-xl font-semibold text-[var(--ink)]">{s.val}</div>
                <div className="text-xs text-[var(--ink-3)] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Marketler bandı — koyulaştırılmış zemin, kartlar öne çıkar */}
        <section className="bg-[var(--surface-2)] border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="font-data text-[11px] tracking-[0.18em] uppercase text-[var(--rise)] mb-1.5">Şu an oynanıyor</div>
              <h2 className="font-display text-2xl font-bold text-[var(--ink)]">Aktif Marketler</h2>
            </div>
            <Link href="/markets" className="text-sm font-semibold text-[var(--rise)] hover:underline">
              Tümünü gör →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} href={cardHref} />
            ))}
          </div>
          </div>

        </section>

        {/* CTA bandı */}
        <section className="max-w-7xl mx-auto px-4 py-14">
          <div className="tabela rounded-2xl px-8 py-10 text-center">
            <h3 className="font-display text-2xl font-bold text-white mb-2">Var mısın?</h3>
            <p className="text-sm text-[var(--board-text)] mb-6">
              {loggedIn
                ? 'Marketler seni bekliyor — tahminini koy, sıralamada yüksel.'
                : 'Kayıt ol, ◈100.000 kredin hazır. Kredi kartı yok, gerçek para yok — hiçbir zaman.'}
            </p>
            <Link href={loggedIn ? '/markets' : '/register'} className="inline-block bg-[var(--rise)] text-white font-semibold px-8 py-3 rounded-xl hover:brightness-110 transition-all text-sm [font-family:var(--font-body)]">
              {loggedIn ? 'Marketlere Git' : 'Ücretsiz Hesap Aç'}
            </Link>
          </div>

          <p className="text-center text-xs text-[var(--ink-3)] py-8">
            AçıkBazaar bir simülasyondur. Gerçek para içermez, bahis hizmeti değildir.
          </p>
        </section>
      </div>
    </LangProvider>
  );
}
