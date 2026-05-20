'use client';

import { LeaderboardEntry } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits } from '@/lib/utils';

interface Props { entries: LeaderboardEntry[] }
const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardClient({ entries }: Props) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">{t('Sıralama', 'Leaderboard')}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t('Kâra göre sıralı top 100', 'Top 100 by profit')}</p>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_repeat(4,auto)] gap-4 px-5 py-3 border-b border-[#F3F4F6] bg-[#F9FAFB] text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          <span>#</span>
          <span>{t('Kullanıcı', 'User')}</span>
          <span className="hidden sm:block">{t('Bakiye', 'Balance')}</span>
          <span className="hidden sm:block">{t('Bahis', 'Bets')}</span>
          <span className="hidden sm:block">{t('Başarı', 'Win %')}</span>
          <span>{t('Kâr', 'Profit')}</span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-[#9CA3AF] text-sm">{t('Henüz veri yok.', 'No data yet.')}</div>
        ) : (
          entries.map((entry, i) => (
            <div key={entry.username}
              className="grid grid-cols-[3rem_1fr_repeat(4,auto)] gap-4 px-5 py-3.5 border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFAFA] transition-colors items-center text-sm">
              <span className="text-[#9CA3AF] font-medium">{i < 3 ? MEDALS[i] : `#${i + 1}`}</span>
              <span className={`font-semibold ${i === 0 ? 'text-[#16A34A]' : 'text-[#111827]'}`}>@{entry.username}</span>
              <span className="hidden sm:block text-[#6B7280] text-xs">◈{formatCredits(entry.balance)}</span>
              <span className="hidden sm:block text-[#6B7280] text-xs">{entry.total_bets}</span>
              <span className="hidden sm:block text-[#6B7280] text-xs">{entry.win_rate}%</span>
              <span className={`font-bold text-sm ${entry.profit >= 0 ? 'text-[#16A34A]' : 'text-red-500'}`}>
                {entry.profit >= 0 ? '+' : ''}◈{formatCredits(entry.profit)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
