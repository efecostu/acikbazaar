'use client';

import { Profile, Bet } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { formatCredits, formatDate } from '@/lib/utils';
import { computeBadges } from '@/lib/badges';
import { ShareBar } from '@/components/ShareBar';
import {
  Target, Hash, Medal, Trophy, Gem, Zap, GraduationCap, Flame, CalendarCheck, TrendingUp, Handshake, Crown,
  type LucideProps,
} from 'lucide-react';
import type { BadgeIcon } from '@/lib/badges';

const BADGE_ICONS: Record<BadgeIcon, React.ComponentType<LucideProps>> = {
  target: Target, hash: Hash, medal: Medal, trophy: Trophy, gem: Gem, zap: Zap,
  graduation: GraduationCap, flame: Flame, calendar: CalendarCheck, trending: TrendingUp,
  handshake: Handshake, crown: Crown,
};

interface Props { profile: Profile | null; email: string; bets: Bet[] }

export function ProfileClient({ profile, email, bets }: Props) {
  const { lang, t } = useLang();
  if (!profile) return <div className="text-center py-16 text-[var(--ink-3)] text-sm">{t('Profil yüklenemedi.', 'Failed to load profile.')}</div>;

  const wonBets = bets.filter((b) => b.status === 'won');
  const lostBets = bets.filter((b) => b.status === 'lost');
  const totalProfit = wonBets.reduce((s, b) => s + b.potential_payout - b.amount, 0) - lostBets.reduce((s, b) => s + b.amount, 0);
  const badges = computeBadges(profile, bets);
  const earned = badges.filter((b) => b.earned);

  const stats = [
    { label: t('Bakiye', 'Balance'), value: `◈${formatCredits(profile.balance)}`, accent: true },
    { label: t('Toplam Bahis', 'Total Bets'), value: profile.total_bets.toString() },
    { label: t('Kazanılan', 'Won'), value: wonBets.length.toString() },
    { label: t('Kaybedilen', 'Lost'), value: lostBets.length.toString() },
    { label: t('Başarı Oranı', 'Win Rate'), value: profile.total_bets > 0 ? `${Math.round(profile.total_won / profile.total_bets * 100)}%` : '—' },
    { label: t('Toplam Kâr', 'P&L'), value: `${totalProfit >= 0 ? '+' : ''}◈${formatCredits(totalProfit)}`, isProfit: true, profit: totalProfit },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Profile card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--rise-soft)] border border-[var(--rise-line)] flex items-center justify-center text-2xl font-bold text-[var(--rise)]">
            {profile.username[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-[var(--ink)]">@{profile.username}</p>
            <p className="text-sm text-[var(--ink-2)] truncate">{email}</p>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">
              {t('Katılım', 'Joined')}: {formatDate(profile.created_at, lang)}
              {(profile.streak_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 ml-1 text-[var(--copper)]">
                  · <Flame size={11} strokeWidth={2} aria-hidden /> {profile.streak_count} {t('gün seri', 'day streak')}
                </span>
              )}
            </p>
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

      {/* Davet */}
      <div className="tabela rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="tabela-label mb-1">{t('arkadaşını davet et', 'invite a friend')}</div>
            <p className="text-sm text-white">
              {t('Her davet için ikinize de ◈5.000 bonus.', 'You both get ◈5,000 for every invite.')}
              {(profile.referral_count ?? 0) > 0 && (
                <span className="tabela-rise ml-2">{profile.referral_count} {t('davet', 'invited')}</span>
              )}
            </p>
          </div>
          <code className="font-data text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--board-line)', color: 'var(--board-text)' }}>
            acikbazaar.com/register?ref={profile.username}
          </code>
        </div>
        <ShareBar
          compact
          path={`/register?ref=${profile.username}`}
          text={t('AçıkBazaar\'da tahmin yarışına katıl — ücretsiz, gerçek para yok. Bu linkle kayıt olursan ◈5.000 bonus kredi alırsın:', 'Join me on AçıkBazaar — free prediction markets, no real money. Sign up with this link for ◈5,000 bonus credits:')}
        />
      </div>

      {/* Rozetler */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 transition-colors duration-200">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t('Rozetler', 'Badges')}</h2>
          <span className="font-data text-xs text-[var(--ink-3)]">{earned.length} / {badges.length}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {badges.map((b) => (
            <div key={b.id} title={lang === 'tr' ? b.descTr : b.descEn}
              className={`rounded-xl border p-3 text-center transition-colors ${
                b.earned
                  ? 'border-[var(--copper-line)] bg-[var(--copper-soft)]'
                  : 'border-[var(--border-light)] bg-[var(--surface-2)] opacity-45 grayscale'
              }`}>
              {(() => { const Icon = BADGE_ICONS[b.icon]; return (
                <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center" style={{ background: b.earned ? 'rgba(180,101,47,0.12)' : 'transparent' }}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden className={b.earned ? 'text-[var(--copper)]' : 'text-[var(--ink-3)]'} />
                </div>
              ); })()}
              <div className={`text-[11px] font-semibold mt-1.5 leading-tight ${b.earned ? 'text-[var(--copper)]' : 'text-[var(--ink-3)]'}`}>
                {lang === 'tr' ? b.tr : b.en}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
