'use client';

import { useState } from 'react';
import { Market, MarketCategory, MarketRegion } from '@/types';
import { MarketCard } from '@/components/MarketCard';
import { useLang } from '@/contexts/LangContext';
import { categoryLabel } from '@/lib/utils';
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
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">{t('Aktif Marketler', 'Active Markets')}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t('Gerçek hayat eventleri · Sanal kredi ile tahmin yap', 'Real-life events · Predict with virtual credits')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={t('Market ara...', 'Search markets...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                category === cat
                  ? 'border-[#16A34A] text-[#16A34A] bg-[#F0FDF4]'
                  : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB] bg-white'
              )}>
              {cat === 'all' ? t('Tümü', 'All') : categoryLabel(cat, lang)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {REGIONS.map((reg) => (
            <button key={reg} onClick={() => setRegion(reg)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                region === reg
                  ? 'border-[#16A34A] text-[#16A34A] bg-[#F0FDF4]'
                  : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB] bg-white'
              )}>
              {reg === 'all' ? t('Tümü', 'All') : reg === 'turkey' ? '🇹🇷 TR' : '🌐 Global'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#9CA3AF] text-sm">
          {t('Market bulunamadı.', 'No markets found.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      <p className="text-xs text-[#9CA3AF] text-center">
        {filtered.length} / {markets.length} {t('market', 'markets')}
      </p>
    </div>
  );
}
