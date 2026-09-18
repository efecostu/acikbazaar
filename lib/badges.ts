import type { Bet, Profile } from '@/types';

export interface Badge {
  id: string;
  icon: string;
  tr: string;
  en: string;
  descTr: string;
  descEn: string;
  earned: boolean;
}

/** Profil + bahis geçmişinden rozetleri hesaplar. DB gerekmez; deterministik. */
export function computeBadges(profile: Profile, bets: Bet[]): Badge[] {
  const won = bets.filter((b) => b.status === 'won');
  const settled = bets.filter((b) => b.status !== 'pending');
  const bigWin = won.some((b) => b.potential_payout - b.amount >= 20_000);
  const underdog = won.some((b) => b.odds_at_bet >= 3);
  const winRate = settled.length >= 10 ? won.length / settled.length : 0;
  const profit = won.reduce((s, b) => s + b.potential_payout - b.amount, 0)
    - bets.filter((b) => b.status === 'lost').reduce((s, b) => s + b.amount, 0);
  const streak = profile.streak_count ?? 0;
  const referrals = profile.referral_count ?? 0;

  return [
    { id: 'first', icon: '🎯', tr: 'İlk Tahmin', en: 'First Call', descTr: 'İlk bahsini yaptın', descEn: 'Placed your first bet', earned: bets.length >= 1 },
    { id: 'ten', icon: '🔟', tr: 'Düzenli', en: 'Regular', descTr: '10 bahis', descEn: '10 bets placed', earned: bets.length >= 10 },
    { id: 'fifty', icon: '💯', tr: 'Müdavim', en: 'Veteran', descTr: '50 bahis', descEn: '50 bets placed', earned: bets.length >= 50 },
    { id: 'firstwin', icon: '🏆', tr: 'İlk Zafer', en: 'First Win', descTr: 'İlk kazanan tahmin', descEn: 'First winning bet', earned: won.length >= 1 },
    { id: 'bigwin', icon: '💎', tr: 'Büyük Vurgun', en: 'Big Score', descTr: 'Tek bahiste ◈20.000+ kâr', descEn: '◈20,000+ profit in one bet', earned: bigWin },
    { id: 'underdog', icon: '🐺', tr: 'Sürpriz Avcısı', en: 'Underdog Hunter', descTr: '3x+ oranla kazandın', descEn: 'Won at 3x+ odds', earned: underdog },
    { id: 'sharp', icon: '🎓', tr: 'Keskin Göz', en: 'Sharp', descTr: '10+ bahiste %60+ isabet', descEn: '60%+ win rate over 10+ bets', earned: winRate >= 0.6 },
    { id: 'streak3', icon: '🔥', tr: '3 Gün Seri', en: '3-Day Streak', descTr: '3 gün üst üste tahmin', descEn: '3 consecutive days', earned: streak >= 3 },
    { id: 'streak7', icon: '☄️', tr: 'Haftalık Seri', en: 'Weekly Streak', descTr: '7 gün üst üste tahmin', descEn: '7 consecutive days', earned: streak >= 7 },
    { id: 'profit', icon: '📈', tr: 'Kârda', en: 'In Profit', descTr: 'Toplam kâr ◈10.000+', descEn: 'Total profit ◈10,000+', earned: profit >= 10_000 },
    { id: 'referral', icon: '🤝', tr: 'Davetçi', en: 'Recruiter', descTr: 'Bir arkadaşını davet ettin', descEn: 'Invited a friend', earned: referrals >= 1 },
    { id: 'whale', icon: '🐋', tr: 'Balina', en: 'Whale', descTr: 'Bakiye ◈200.000+', descEn: 'Balance ◈200,000+', earned: profile.balance >= 200_000 },
  ];
}
