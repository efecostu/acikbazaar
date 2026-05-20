'use client';

import { Profile, Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';

interface Props { profile: Profile | null; email: string; bets: Bet[] }

export function ProfileClient({ profile, email, bets }: Props) {
  const { lang, t } = useLang();
  if (!profile) return <div className="text-center py-16 text-[#9CA3AF] text-sm">{t('Profil yüklenemedi.', 'Failed to load profile.')}</div>;

  const wonBets = bets.filter((b) => b.status === 'won');
  const lostBets = bets.filter((b) => b.status === 'lost');
  const totalProfit = wonBets.reduce((s, b) => s + b.potential_payout - b.amount, 0) - lostBets.reduce((s, b) => s + b.amount, 0);

  const stats = [
    { label: t('Bakiye', 'Balance'), value: `◈${formatCredits(profile.balance)}`, accent: true },
    { label: t('Toplam Bahis', 'Total Bets'), value: profile.total_bets.toString() },
    { label: t('Kazanılan', 'Won'), value: wonBets.length.toString() },
    { label: t('Kaybedilen', 'Lost'), value: lostBets.length.toString() },
    { label: t('Başarı Oranı', 'Win Rate'), value: profile.total_bets > 0 ? `${Math.round(profile.total_won / profile.total_bets * 100)}%` : '—' },
    { label: t('Toplam Kâr', 'P&L'), value: `${totalProfit >= 0 ? '+' : ''}◈${formatCredits(totalProfit)}`, isProfit: true, profit: totalProfit },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      {/* Profile card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-2xl font-bold text-[#16A34A]">
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-[#111827]">@{profile.username}</p>
            <p className="text-sm text-[#6B7280]">{email}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{t('Katılım', 'Joined')}: {formatDate(profile.created_at, lang)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${
              s.isProfit ? ((s.profit ?? 0) >= 0 ? 'text-[#16A34A]' : 'text-red-500') :
              s.accent ? 'text-[#16A34A]' : 'text-[#111827]'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
