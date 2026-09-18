'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Market, MarketCategory, MarketRegion } from '@/types';
import { MarketCard } from '@/components/MarketCard';
import { LiveTicker, TradeRow } from '@/components/LiveTicker';
import { useLang } from '@/contexts/LangContext';
import { Lightbulb, Search, Sparkles } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categoryLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

const CATEGORIES: (MarketCategory | 'all')[] = ['all', 'politics', 'economy', 'sports', 'tech', 'world', 'entertainment', 'weather'];
const REGIONS: (MarketRegion | 'all')[] = ['all', 'turkey', 'global'];

interface Props {
  markets: Market[];
  interests?: string[] | null;
  trades?: TradeRow[];
}

export function MarketsClient({ markets, interests = null, trades = [] }: Props) {
  const { lang, t } = useLang();
  const hasInterests = !!interests && interests.length > 0 && interests.length < 7;
  const [category, setCategory] = useState<MarketCategory | 'all' | 'foryou'>(hasInterests ? 'foryou' : 'all');
  const [region, setRegion] = useState<MarketRegion | 'all'>('all');
  const [search, setSearch] = useState('');

  const isAwaiting = (m: Market) =>
    m.status === 'closed' || (m.status === 'active' && new Date(m.ends_at).getTime() <= Date.now());

  const filtered = markets.filter((m) => {
    if (category === 'foryou') {
      if (!interests?.includes(m.category)) return false;
    } else if (category !== 'all' && m.category !== category) return false;
    if (region !== 'all' && m.region !== region) return false;
    if (search) {
      const q = search.toLowerCase();
      const title = lang === 'tr' ? m.title_tr : m.title_en;
      if (!title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const open = filtered.filter((m) => !isAwaiting(m));
  const awaiting = filtered.filter(isAwaiting);

  return (
    <div className="flex flex-col gap-6">
      {/* Canlı işlem şeridi */}
      <LiveTicker initialTrades={trades} />

      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[var(--ink)]">{t('Aktif Marketler', 'Active Markets')}</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">{t('Gerçek hayat eventleri · Sanal kredi ile tahmin yap', 'Real-life events · Predict with virtual credits')}</p>
        </div>
        <Link
          href="/markets/suggest"
          className="text-sm font-semibold text-[var(--rise)] border border-[var(--rise-line)] bg-[var(--rise-soft)] px-4 py-2 rounded-xl hover:brightness-105 transition-all"
        >
          <span className="inline-flex items-center gap-1.5"><Lightbulb size={14} strokeWidth={2} aria-hidden />{t('Market Öner', 'Suggest a Market')}</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} strokeWidth={2} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
        <input
          type="search"
          aria-label={t('Market ara', 'Search markets')}
          placeholder={t('Market ara...', 'Search markets...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {hasInterests && (
            <button onClick={() => setCategory('foryou')}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                category === 'foryou'
                  ? 'border-[var(--copper)] text-[var(--copper)] bg-[var(--copper-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
              )}>
              <span className="inline-flex items-center gap-1.5"><Sparkles size={13} strokeWidth={2} aria-hidden />{t('Senin için', 'For you')}</span>
            </button>
          )}
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                category === cat
                  ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
              )}>
              {cat === 'all' ? t('Tümü', 'All') : (
                <span className="inline-flex items-center gap-1.5"><CategoryIcon category={cat} size={13} />{categoryLabel(cat, lang)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {REGIONS.map((reg) => (
            <button key={reg} onClick={() => setRegion(reg)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                region === reg
                  ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
              )}>
              {reg === 'all' ? t('Tümü', 'All') : reg === 'turkey' ? t('Türkiye', 'Türkiye') : 'Global'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {open.length === 0 && awaiting.length === 0 ? (
        <div className="text-center py-20 text-[var(--ink-3)] text-sm">
          {t('Market bulunamadı. Filtreleri sıfırlamayı dene.', 'No markets found. Try clearing the filters.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {open.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      {awaiting.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-base font-bold text-[var(--ink)]">{t('Sonuç bekleniyor', 'Awaiting result')}</h2>
            <span className="text-xs text-[var(--ink-3)]">{t('Kapandı, sonuç doğrulanınca ödenir', 'Closed, paid out once verified')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
            {awaiting.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </div>
      )}

      <p className="font-data text-xs text-[var(--ink-3)] text-center">
        {open.length} {t('açık', 'open')} · {awaiting.length} {t('sonuç bekliyor', 'awaiting')}
      </p>
    </div>
  );
}
