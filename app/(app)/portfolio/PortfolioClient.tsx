'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  bets: Bet[];
}

type Filter = 'all' | 'pending' | 'won' | 'lost';

export function PortfolioClient({ bets }: Props) {
  const { lang, t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = bets.filter((b) => filter === 'all' || b.status === filter);

  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter((b) => b.status === 'won').reduce((s, b) => s + b.potential_payout, 0);
  const totalLost = bets.filter((b) => b.status === 'lost').reduce((s, b) => s + b.amount, 0);
  const profit = totalWon - totalLost;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('Tümü', 'All') },
    { key: 'pending', label: t('Bekliyor', 'Pending') },
    { key: 'won', label: t('Kazandı', 'Won') },
    { key: 'lost', label: t('Kaybetti', 'Lost') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-[#F0F2F5]">{t('Portföy', 'Portfolio')}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('Toplam Bahis', 'Total Bets'), value: bets.length, suffix: '' },
          { label: t('Toplam Harcanan', 'Total Wagered'), value: `◈${formatCredits(totalWagered)}`, suffix: '' },
          { label: t('Toplam Kazanılan', 'Total Won'), value: `◈${formatCredits(totalWon)}`, suffix: '' },
          { label: t('Kâr / Zarar', 'P&L'), value: `${profit >= 0 ? '+' : ''}◈${formatCredits(profit)}`, suffix: '' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#131620] border border-[#1E2130] rounded-lg p-3">
            <p className="text-[10px] text-[#8892A4] uppercase tracking-wider">{stat.label}</p>
            <p className={`text-sm font-bold mt-1 ${stat.label.includes('Kâr') || stat.label.includes('P&L') ? (profit >= 0 ? 'text-[#00FF88]' : 'text-red-400') : 'text-[#F0F2F5]'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 text-xs rounded border transition-colors',
              filter === f.key
                ? 'border-[#00FF88] text-[#00FF88] bg-[#00FF88]/10'
                : 'border-[#1E2130] text-[#8892A4] hover:border-[#00FF88]/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bets list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8892A4] text-sm">
          {t('Henüz bahis yok.', 'No bets yet.')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((bet) => {
            const title = bet.market
              ? lang === 'tr'
                ? bet.market.title_tr
                : bet.market.title_en
              : bet.market_id;

            return (
              <Link key={bet.id} href={`/markets/${bet.market_id}`}>
                <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[#00FF88]/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#F0F2F5] leading-snug line-clamp-2">{title}</p>
                    <p className="text-[10px] text-[#4B5563] mt-1">{formatDate(bet.created_at, lang)}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <span className={bet.side === 'yes' ? 'text-[#00FF88] font-bold' : 'text-red-400 font-bold'}>
                      {bet.side.toUpperCase()}
                    </span>
                    <span className="text-[#8892A4]">◈{formatCredits(bet.amount)}</span>
                    <span className="text-[#8892A4]">{bet.odds_at_bet}x</span>
                    <span className="text-[#8892A4]">→ ◈{formatCredits(bet.potential_payout)}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] border',
                      bet.status === 'won' && 'text-[#00FF88] border-[#00FF88]/30 bg-[#00FF88]/10',
                      bet.status === 'lost' && 'text-red-400 border-red-500/30 bg-red-500/10',
                      bet.status === 'pending' && 'text-[#8892A4] border-[#1E2130]',
                    )}>
                      {bet.status === 'won' ? t('KAZANDI', 'WON') : bet.status === 'lost' ? t('KAYBETTİ', 'LOST') : t('Bekliyor', 'Pending')}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
