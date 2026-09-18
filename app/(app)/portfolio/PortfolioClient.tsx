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
      <h1 className="font-display text-[26px] font-bold text-[var(--ink)]">{t('Portföy', 'Portfolio')}</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('Toplam Bahis', 'Total Bets'), value: bets.length.toString() },
          { label: t('Toplam Harcanan', 'Wagered'), value: `◈${formatCredits(totalWagered)}` },
          { label: t('Kazanılan', 'Won'), value: wonBets.length.toString() },
          { label: t('Kâr / Zarar', 'P&L'), value: `${profit >= 0 ? '+' : ''}◈${formatCredits(profit)}`, isProfit: true, profit },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 transition-colors duration-200">
            <p className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-wider">{s.label}</p>
            <p className={`font-data text-lg font-bold mt-1 ${
              s.isProfit ? ((s.profit ?? 0) >= 0 ? 'text-[var(--rise)]' : 'text-[var(--fall)]') : 'text-[var(--ink)]'
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
                ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Bets list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--ink-3)] text-sm">{t('Henüz bahis yok.', 'No bets yet.')}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((bet) => {
            const title = bet.market ? (lang === 'tr' ? bet.market.title_tr : bet.market.title_en) : bet.market_id;
            return (
              <Link key={bet.id} href={`/markets/${bet.market_id}`}>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[var(--ink-3)] hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] leading-snug line-clamp-1">{title}</p>
                    <p className="text-xs text-[var(--ink-3)] mt-0.5">{formatDate(bet.created_at, lang)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <span className={`font-bold ${bet.side !== 'no' ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>{bet.side ? bet.side.toUpperCase() : 'SEÇENEK'}</span>
                    <span className="font-data text-[var(--ink-2)]">◈{formatCredits(bet.amount)}</span>
                    <span className="font-data text-[var(--ink-3)]">{bet.odds_at_bet}x</span>
                    <span className="font-data text-[var(--ink-3)]">→ ◈{formatCredits(bet.potential_payout)}</span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md',
                      bet.status === 'won' && 'bg-[var(--rise-soft)] text-[var(--rise)]',
                      bet.status === 'lost' && 'bg-[var(--fall-soft)] text-[var(--fall)]',
                      bet.status === 'pending' && 'bg-[var(--surface-2)] text-[var(--ink-3)]',
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
