'use client';

import { Profile, Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';

interface Props {
  profile: Profile | null;
  email: string;
  bets: Bet[];
}

export function ProfileClient({ profile, email, bets }: Props) {
  const { lang, t } = useLang();

  if (!profile) {
    return (
      <div className="text-center py-16 text-[#8892A4] text-sm">
        {t('Profil yüklenemedi.', 'Failed to load profile.')}
      </div>
    );
  }

  const wonBets = bets.filter((b) => b.status === 'won');
  const lostBets = bets.filter((b) => b.status === 'lost');
  const pendingBets = bets.filter((b) => b.status === 'pending');
  const totalProfit = wonBets.reduce((s, b) => s + b.potential_payout - b.amount, 0)
    - lostBets.reduce((s, b) => s + b.amount, 0);

  const stats = [
    { label: t('Bakiye', 'Balance'), value: `◈${formatCredits(profile.balance)}`, highlight: true },
    { label: t('Toplam Bahis', 'Total Bets'), value: profile.total_bets },
    { label: t('Kazanılan', 'Won'), value: wonBets.length },
    { label: t('Kaybedilen', 'Lost'), value: lostBets.length },
    { label: t('Bekleyen', 'Pending'), value: pendingBets.length },
    { label: t('Başarı Oranı', 'Win Rate'), value: profile.total_bets > 0 ? `${Math.round(profile.total_won / profile.total_bets * 100)}%` : '—' },
    { label: t('Toplam Kâr', 'Total P&L'), value: `${totalProfit >= 0 ? '+' : ''}◈${formatCredits(totalProfit)}`, profit: totalProfit },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Profile header */}
      <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#00FF88]/20 border border-[#00FF88]/40 flex items-center justify-center text-xl text-[#00FF88]">
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-base font-bold text-[#F0F2F5]">@{profile.username}</p>
            <p className="text-xs text-[#8892A4]">{email}</p>
            <p className="text-[10px] text-[#4B5563] mt-0.5">
              {t('Katılım', 'Joined')}: {formatDate(profile.created_at, lang)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label.toString()} className="bg-[#131620] border border-[#1E2130] rounded-lg p-3">
            <p className="text-[10px] text-[#8892A4] uppercase tracking-wider">{stat.label}</p>
            <p className={`text-sm font-bold mt-1 ${
              'profit' in stat
                ? (stat.profit as number) >= 0 ? 'text-[#00FF88]' : 'text-red-400'
                : stat.highlight ? 'text-[#00FF88]' : 'text-[#F0F2F5]'
            }`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
