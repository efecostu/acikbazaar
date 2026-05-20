'use client';

import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { Market } from '@/types';
import { Badge } from './ui/Badge';
import { categoryColor, categoryLabel, daysUntil, formatCredits } from '@/lib/utils';
import { calculateOdds } from '@/lib/odds';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const { lang, t } = useLang();
  const { yesProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
  const yesPct = Math.round(yesProb * 100);
  const days = daysUntil(market.ends_at);
  const title = lang === 'tr' ? market.title_tr : market.title_en;
  const catColor = categoryColor(market.category);

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="market-card bg-[#131620] border border-[#1E2130] rounded-lg p-4 flex flex-col gap-3 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={catColor}>{categoryLabel(market.category, lang)}</Badge>
            {market.tag && (
              <Badge className="bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30">
                {market.tag}
              </Badge>
            )}
            <span className="text-[10px] text-[#4B5563]">
              {market.region === 'turkey' ? '🇹🇷' : '🌐'}
            </span>
          </div>
          <span className={`text-xs shrink-0 ${days <= 7 ? 'text-red-400' : 'text-[#8892A4]'}`}>
            {days}d
          </span>
        </div>

        {/* Title */}
        <p className="text-sm text-[#F0F2F5] leading-snug line-clamp-2">{title}</p>

        {/* Prob bar */}
        <div>
          <div className="prob-bar">
            <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-[#00FF88]">YES {yesPct}% · {yesOdds}x</span>
            <span className="text-xs text-red-400">NO {100 - yesPct}% · {noOdds}x</span>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between text-[10px] text-[#4B5563] pt-1 border-t border-[#1E2130]">
          <span>{t('Hacim', 'Vol')}: ◈{formatCredits(market.total_volume)}</span>
          <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
        </div>
      </div>
    </Link>
  );
}
