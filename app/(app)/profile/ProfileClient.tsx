'use client';

import { Profile, Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';

interface Props { profile: Profile | null; email: string; bets: Bet[] }

export function ProfileClient({ profile, email, bets }: Props) {
  const { lang, t } = useLang();
  if (!profile) return <div className="text-center py-16 text-[var(--ink-3)] text-sm">{t('Profil yüklenemedi.', 'Failed to load profile.')}</div>;

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
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--rise-soft)] border border-[var(--rise-line)] flex items-center justify-center text-2xl font-bold text-[var(--rise)]">
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <p className="font-display text-lg font-bold text-[var(--ink)]">@{profile.username}</p>
            <p className="text-sm text-[var(--ink-2)]">{email}</p>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('Katılım', 'Joined')}: {formatDate(profile.created_at, lang)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 transition-colors duration-200">
            <p className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-wider">{s.label}</p>
            <p className={`font-data text-lg font-bold mt-1 ${
              s.isProfit ? ((s.profit ?? 0) >= 0 ? 'text-[var(--rise)]' : 'text-[var(--fall)]') :
              s.accent ? 'text-[var(--rise)]' : 'text-[var(--ink)]'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
