'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Market, MarketCategory, MarketRegion } from '@/types';
import { MarketCard } from '@/components/MarketCard';
import { useLang } from '@/contexts/LangContext';
import { categoryLabel, categoryEmoji } from '@/lib/utils';
import { cn } from '@/lib/utils';

const CATEGORIES: (MarketCategory | 'all')[] = ['all', 'politics', 'economy', 'sports', 'tech', 'world', 'entertainment', 'weather'];
const REGIONS: (MarketRegion | 'all')[] = ['all', 'turkey', 'global'];

interface Props { markets: Market[] }

export function MarketsClient({ markets }: Props) {
  const { lang, t } = useLang();
  const [category, setCategory] = useState<MarketCategory | 'all'>('all');
  const [region, setRegion] = useState<MarketRegion | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = markets.filter((m) => {
    if (category !== 'all' && m.category !== category) return false;
    if (region !== 'all' && m.region !== region) return false;
    if (search) {
      const q = search.toLowerCase();
      const title = lang === 'tr' ? m.title_tr : m.title_en;
      if (!title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
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
          💡 {t('Market Öner', 'Suggest a Market')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={t('Market ara...', 'Search markets...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                category === cat
                  ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
              )}>
              {cat === 'all' ? t('Tümü', 'All') : `${categoryEmoji(cat)} ${categoryLabel(cat, lang)}`}
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
              {reg === 'all' ? t('Tümü', 'All') : reg === 'turkey' ? '🇹🇷 TR' : '🌐 Global'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--ink-3)] text-sm">
          {t('Market bulunamadı. Filtreleri sıfırlamayı dene.', 'No markets found. Try clearing the filters.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      <p className="font-data text-xs text-[var(--ink-3)] text-center">
        {filtered.length} / {markets.length} {t('market', 'markets')}
      </p>
    </div>
  );
}
