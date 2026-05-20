'use client';

import { LeaderboardEntry } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits } from '@/lib/utils';

interface Props {
  entries: LeaderboardEntry[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardClient({ entries }: Props) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-[#F0F2F5]">{t('Sıralama', 'Leaderboard')}</h1>
        <p className="text-xs text-[#8892A4] mt-1">{t('Kâra göre sıralı top 100', 'Top 100 by profit')}</p>
      </div>

      <div className="bg-[#131620] border border-[#1E2130] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_repeat(4,auto)] gap-4 px-4 py-3 border-b border-[#1E2130] text-[10px] text-[#4B5563] uppercase tracking-wider">
          <span>#</span>
          <span>{t('Kullanıcı', 'User')}</span>
          <span className="hidden sm:block">{t('Bakiye', 'Balance')}</span>
          <span className="hidden sm:block">{t('Bahisler', 'Bets')}</span>
          <span className="hidden sm:block">{t('Başarı %', 'Win %')}</span>
          <span>{t('Kâr', 'Profit')}</span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-[#8892A4] text-sm">
            {t('Henüz veri yok.', 'No data yet.')}
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.username}
              className="grid grid-cols-[3rem_1fr_repeat(4,auto)] gap-4 px-4 py-3 border-b border-[#1E2130] last:border-0 text-sm hover:bg-[#0F1117] transition-colors items-center"
            >
              <span className="text-[#8892A4]">
                {i < 3 ? MEDALS[i] : `#${i + 1}`}
              </span>
              <span className={`font-mono ${i === 0 ? 'text-[#00FF88]' : 'text-[#F0F2F5]'}`}>
                @{entry.username}
              </span>
              <span className="hidden sm:block text-[#8892A4] text-xs">◈{formatCredits(entry.balance)}</span>
              <span className="hidden sm:block text-[#8892A4] text-xs">{entry.total_bets}</span>
              <span className="hidden sm:block text-[#8892A4] text-xs">{entry.win_rate}%</span>
              <span className={`text-xs font-bold ${entry.profit >= 0 ? 'text-[#00FF88]' : 'text-red-400'}`}>
                {entry.profit >= 0 ? '+' : ''}◈{formatCredits(entry.profit)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
