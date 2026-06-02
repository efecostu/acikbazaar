'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props { bets: Bet[] }
type Filter = 'all' | 'pending' | 'won' | 'lost';

export function PortfolioClient({ bets }: Props) {
  const { lang, t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = bets.filter((b) => filter === 'all' || b.status === filter);

  const wonBets = bets.filter((b) => b.status === 'won');
  const lostBets = bets.filter((b) => b.status === 'lost');
  const profit = wonBets.reduce((s, b) => s + b.potential_payout - b.amount, 0)
    - lostBets.reduce((s, b) => s + b.amount, 0);
  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('Tümü', 'All') },
    { key: 'pending', label: t('Bekliyor', 'Pending') },
    { key: 'won', label: t('Kazandı', 'Won') },
    { key: 'lost', label: t('Kaybetti', 'Lost') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F1F5F9]">{t('Portföy', 'Portfolio')}</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('Toplam Bahis', 'Total Bets'), value: bets.length.toString() },
          { label: t('Toplam Harcanan', 'Wagered'), value: `◈${formatCredits(totalWagered)}` },
          { label: t('Kazanılan', 'Won'), value: wonBets.length.toString() },
          { label: t('Kâr / Zarar', 'P&L'), value: `${profit >= 0 ? '+' : ''}◈${formatCredits(profit)}`, isProfit: true, profit },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-xl p-4 transition-colors duration-200">
            <p className="text-xs font-medium text-[#9CA3AF] dark:text-[#64748B] uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${
              s.isProfit ? ((s.profit ?? 0) >= 0 ? 'text-[#16A34A]' : 'text-red-500 dark:text-red-400') : 'text-[#111827] dark:text-[#F1F5F9]'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
              filter === f.key
                ? 'border-[#16A34A] text-[#16A34A] bg-[#F0FDF4] dark:bg-[#14532D]/40'
                : 'border-[#E5E7EB] dark:border-[#334155] text-[#6B7280] dark:text-[#94A3B8] hover:border-[#D1D5DB] dark:hover:border-[#475569] bg-white dark:bg-[#1E293B]'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Bets list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#9CA3AF] dark:text-[#64748B] text-sm">{t('Henüz bahis yok.', 'No bets yet.')}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((bet) => {
            const title = bet.market ? (lang === 'tr' ? bet.market.title_tr : bet.market.title_en) : bet.market_id;
            return (
              <Link key={bet.id} href={`/markets/${bet.market_id}`}>
                <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[#D1D5DB] dark:hover:border-[#475569] hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111827] dark:text-[#F1F5F9] leading-snug line-clamp-1">{title}</p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mt-0.5">{formatDate(bet.created_at, lang)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <span className={`font-bold ${bet.side === 'yes' ? 'text-[#16A34A]' : 'text-red-500 dark:text-red-400'}`}>{bet.side.toUpperCase()}</span>
                    <span className="text-[#6B7280] dark:text-[#94A3B8]">◈{formatCredits(bet.amount)}</span>
                    <span className="text-[#9CA3AF] dark:text-[#64748B]">{bet.odds_at_bet}x</span>
                    <span className="text-[#9CA3AF] dark:text-[#64748B]">→ ◈{formatCredits(bet.potential_payout)}</span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md',
                      bet.status === 'won' && 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#16A34A]',
                      bet.status === 'lost' && 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400',
                      bet.status === 'pending' && 'bg-[#F9FAFB] dark:bg-[#0F172A] text-[#9CA3AF] dark:text-[#64748B]',
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
