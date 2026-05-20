'use client';

import { useState } from 'react';
import { Market, MarketCategory, MarketRegion } from '@/types';
import { MarketCard } from '@/components/MarketCard';
import { useLang } from '@/contexts/LangContext';
import { categoryLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

const CATEGORIES: (MarketCategory | 'all')[] = ['all', 'politics', 'economy', 'sports', 'tech', 'world'];
const REGIONS: (MarketRegion | 'all')[] = ['all', 'turkey', 'global'];

interface Props {
  markets: Market[];
}

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
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[#F0F2F5]">{t('Aktif Marketler', 'Active Markets')}</h1>
        <p className="text-xs text-[#8892A4] mt-1">{t('Gerçek hayat eventleri · Sanal kredi ile tahmin yap', 'Real-life events · Predict with virtual credits')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder={t('Market ara...', 'Search markets...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-[#0F1117] border border-[#1E2130] rounded px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] outline-none focus:border-[#00FF88] transition-colors font-mono"
        />

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                category === cat
                  ? 'border-[#00FF88] text-[#00FF88] bg-[#00FF88]/10'
                  : 'border-[#1E2130] text-[#8892A4] hover:border-[#00FF88]/50'
              )}
            >
              {cat === 'all' ? t('Tümü', 'All') : categoryLabel(cat, lang)}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {REGIONS.map((reg) => (
            <button
              key={reg}
              onClick={() => setRegion(reg)}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                region === reg
                  ? 'border-[#00FF88] text-[#00FF88] bg-[#00FF88]/10'
                  : 'border-[#1E2130] text-[#8892A4] hover:border-[#00FF88]/50'
              )}
            >
              {reg === 'all' ? t('Tümü', 'All') : reg === 'turkey' ? '🇹🇷 TR' : '🌐 Global'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8892A4] text-sm">
          {t('Market bulunamadı.', 'No markets found.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      {/* Stats footer */}
      <p className="text-xs text-[#4B5563] text-center">
        {filtered.length} / {markets.length} {t('market gösteriliyor', 'markets shown')}
      </p>
    </div>
  );
}
