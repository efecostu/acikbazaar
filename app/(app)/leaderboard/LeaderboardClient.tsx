'use client';

import { useState } from 'react';
import { LeaderboardEntry } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits } from '@/lib/utils';

interface Props { entries: LeaderboardEntry[]; weekly?: LeaderboardEntry[] }
const MEDALS = ['🥇', '🥈', '🥉'];

// Header ve satırlar AYNI kolon şablonunu kullanır — hiza asla kaymaz
const COLS = 'grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] sm:grid-cols-[3rem_minmax(0,1fr)_7rem_4.5rem_5rem_7rem]';

export function LeaderboardClient({ entries: allTime, weekly = [] }: Props) {
  const { t } = useLang();
  const [period, setPeriod] = useState<'week' | 'all'>(weekly.length > 0 ? 'week' : 'all');
  const entries = period === 'week' ? weekly : allTime;

  const tabs: { key: 'week' | 'all'; label: string }[] = [
    { key: 'week', label: t('Bu hafta', 'This week') },
    { key: 'all', label: t('Tüm zamanlar', 'All time') },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[var(--ink)]">{t('Sıralama', 'Leaderboard')}</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            {period === 'week'
              ? t('Son 7 günde kapanan bahislerden kâr', 'Profit from bets settled in the last 7 days')
              : t('Kâra göre sıralı top 100', 'Top 100 by profit')}
          </p>
        </div>
        <div className="flex gap-1.5">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setPeriod(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                period === tab.key
                  ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-colors duration-200">
        {/* Başlık şeridi — tabela */}
        <div className={`tabela grid ${COLS} gap-3 px-5 py-2.5 items-center`}>
          <span className="tabela-label">#</span>
          <span className="tabela-label">{t('kullanıcı', 'user')}</span>
          <span className="tabela-label hidden sm:block text-right">{t('bakiye', 'balance')}</span>
          <span className="tabela-label hidden sm:block text-right">{t('bahis', 'bets')}</span>
          <span className="tabela-label hidden sm:block text-right">{t('başarı', 'win %')}</span>
          <span className="tabela-label text-right">{t('kâr', 'profit')}</span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-[var(--ink-3)] text-sm">
            {period === 'week'
              ? t('Bu hafta henüz kapanan bahis yok.', 'No bets settled this week yet.')
              : t('Henüz veri yok.', 'No data yet.')}
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={entry.username}
              className={`grid ${COLS} gap-3 px-5 py-3.5 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--surface-2)] transition-colors items-center text-sm`}>
              <span className="font-data text-[var(--ink-3)]">{i < 3 ? MEDALS[i] : i + 1}</span>
              <span className={`font-semibold truncate ${i === 0 ? 'text-[var(--rise)]' : 'text-[var(--ink)]'}`}>
                @{entry.username}
                {entry.is_bot && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase bg-[var(--rise-soft)] text-[var(--rise)] border border-[var(--rise-line)] px-1.5 py-0.5 rounded align-middle">BOT</span>
                )}
              </span>
              <span className="font-data hidden sm:block text-right text-[var(--ink-2)] text-xs">◈{formatCredits(entry.balance)}</span>
              <span className="font-data hidden sm:block text-right text-[var(--ink-2)] text-xs">{entry.total_bets}</span>
              <span className="font-data hidden sm:block text-right text-[var(--ink-2)] text-xs">{entry.win_rate}%</span>
              <span className={`font-data font-semibold text-right ${entry.profit >= 0 ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>
                {entry.profit >= 0 ? '+' : ''}◈{formatCredits(entry.profit)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
