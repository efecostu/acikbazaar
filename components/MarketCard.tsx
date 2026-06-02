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
      <div className="market-card bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-xl p-5 flex flex-col gap-4 cursor-pointer h-full transition-colors duration-200">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge color={catColor}>{categoryLabel(market.category, lang)}</Badge>
            {market.tag && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {market.tag}
              </span>
            )}
          </div>
          <span className={`text-xs font-medium shrink-0 ${days <= 7 ? 'text-red-500 dark:text-red-400' : 'text-[#9CA3AF] dark:text-[#64748B]'}`}>
            {days}g kaldı
          </span>
        </div>

        {/* Title */}
        <p className="text-[15px] font-semibold text-[#111827] dark:text-[#F1F5F9] leading-snug line-clamp-2 flex-1">
          {title}
        </p>

        {/* Big probability */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-[#16A34A]">{yesPct}%</div>
            <div className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-0.5">{t('EVET ihtimali', 'YES chance')}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-[#6B7280] dark:text-[#94A3B8]">{100 - yesPct}%</div>
            <div className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{t('HAYIR', 'NO')}</div>
          </div>
        </div>

        {/* Prob bar */}
        <div className="prob-bar">
          <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
        </div>

        {/* Odds row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#16A34A] font-semibold">{yesOdds}x {t('EVET', 'YES')}</span>
          <span className="text-red-500 dark:text-red-400 font-semibold">{noOdds}x {t('HAYIR', 'NO')}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[#9CA3AF] dark:text-[#64748B] pt-2 border-t border-[#F3F4F6] dark:border-[#334155]">
          <span>◈{formatCredits(market.total_volume)} {t('hacim', 'volume')}</span>
          <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
        </div>
      </div>
    </Link>
  );
}
