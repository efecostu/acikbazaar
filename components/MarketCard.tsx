'use client';

import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { Market } from '@/types';
import { Badge } from './ui/Badge';
import { categoryColor, categoryLabel, daysUntil, formatCredits } from '@/lib/utils';
import { calculateOdds } from '@/lib/odds';

interface MarketCardProps {
  market: Market;
  href?: string;
}

export function MarketCard({ market, href }: MarketCardProps) {
  const { lang, t } = useLang();
  const { yesProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
  const yesPct = Math.round(yesProb * 100);
  const days = daysUntil(market.ends_at);
  const title = lang === 'tr' ? market.title_tr : market.title_en;
  const catColor = categoryColor(market.category);
  const link = href ?? `/markets/${market.id}`;

  return (
    <Link href={link}>
      <div className="market-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col cursor-pointer h-full overflow-hidden">
        {/* Üst: kategori, etiket, kalan süre */}
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge color={catColor}>{categoryLabel(market.category, lang)}</Badge>
            {market.tag && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--copper-soft)] text-[var(--copper)] border border-[var(--copper-line)]">
                {market.tag}
              </span>
            )}
          </div>
          <span className={`font-data text-[11px] shrink-0 ${days <= 7 ? 'text-[var(--fall)]' : 'text-[var(--ink-3)]'}`}>
            {days}{t('g', 'd')}
          </span>
        </div>

        {/* Başlık + olasılık */}
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-4 flex-1">
          <p className="text-[15px] font-semibold text-[var(--ink)] leading-snug line-clamp-3">
            {title}
          </p>
          <div className="text-right shrink-0">
            <div className="font-data text-[26px] font-semibold leading-none text-[var(--rise)]">
              {yesPct}<span className="text-[15px]">%</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mt-1">
              {t('evet', 'yes')}
            </div>
          </div>
        </div>

        {/* Prob bar */}
        <div className="px-5 pb-4">
          <div className="prob-bar">
            <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--ink-3)]">
            <span className="font-data">◈{formatCredits(market.total_volume)}</span>
            <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
          </div>
        </div>

        {/* İmza: tabela şeridi — EVET/HAYIR kotasyonu */}
        <div className="tabela px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="tabela-label">{t('evet', 'yes')}</span>
            <span className="tabela-rise text-sm font-medium">{yesOdds.toFixed(2)}</span>
          </div>
          <div className="tabela-divider w-px h-4" />
          <div className="flex items-baseline gap-2">
            <span className="tabela-label">{t('hayır', 'no')}</span>
            <span className="tabela-fall text-sm font-medium">{noOdds.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
