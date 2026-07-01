'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Market, Bet, BetSide } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { calculateOdds, calculatePayout } from '@/lib/odds';
import { categoryColor, categoryLabel, daysUntil, formatCredits, formatDate, getAIFavorites } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AIFavorites } from '@/components/AIFavorites';

interface Props {
  market: Market;
  balance: number;
  userId: string;
  userBets: Bet[];
}

export function MarketDetailClient({ market, balance: initialBalance, userId, userBets }: Props) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [amount, setAmount] = useState(50);
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { yesProb, noProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
  const yesPct = Math.round(yesProb * 100);
  const title = lang === 'tr' ? market.title_tr : market.title_en;
  const description = lang === 'tr' ? market.description_tr : market.description_en;
  const activeSideProb = selectedSide === 'yes' ? yesProb : noProb;
  const activeSideOdds = selectedSide === 'yes' ? yesOdds : noOdds;
  const potentialPayout = selectedSide ? calculatePayout(amount, activeSideProb) : 0;

  const BET_ERRORS: Record<string, [string, string]> = {
    insufficient_balance: ['Yetersiz bakiye.', 'Insufficient balance.'],
    market_closed: ['Market kapandı, bahis alınamıyor.', 'Market is closed.'],
    market_not_found: ['Market bulunamadı.', 'Market not found.'],
    invalid_amount: ['Geçersiz miktar.', 'Invalid amount.'],
    auth_required: ['Giriş yapmalısın.', 'You must be logged in.'],
  };

  async function handlePlaceBet() {
    if (!selectedSide) return;
    if (amount <= 0 || amount > balance) { setError(t('Geçersiz miktar.', 'Invalid amount.')); return; }
    setLoading(true); setError(''); setSuccess('');
    const supabase = createClient();
    // Atomik server-side bahis: doğrulama + bakiye + havuz güncellemesi tek transaction
    const { data, error: betError } = await supabase.rpc('place_bet', {
      p_market_id: market.id, p_side: selectedSide, p_amount: amount,
    });
    if (betError) {
      const known = Object.keys(BET_ERRORS).find((k) => betError.message.includes(k));
      setError(known ? t(...BET_ERRORS[known]) : betError.message);
      setLoading(false);
      return;
    }
    setBalance(data?.new_balance ?? balance - amount);
    setSuccess(t(`◈${amount} kredi — ${selectedSide.toUpperCase()} tarafına bahis yapıldı!`, `Bet placed: ◈${amount} on ${selectedSide.toUpperCase()}!`));
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] transition-colors self-start flex items-center gap-1">
        ← {t('Geri', 'Back')}
      </button>

      {/* Market info */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-6 flex flex-col gap-5 transition-colors duration-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge color={categoryColor(market.category)}>{categoryLabel(market.category, lang)}</Badge>
            {market.tag && <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{market.tag}</span>}
            <span className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{market.region === 'turkey' ? '🇹🇷' : '🌐'}</span>
          </div>
          <span className={`text-xs font-medium ${daysUntil(market.ends_at) <= 7 ? 'text-red-500 dark:text-red-400' : 'text-[#9CA3AF] dark:text-[#64748B]'}`}>
            {t('Bitiş', 'Ends')}: {formatDate(market.ends_at, lang)}
          </span>
        </div>

        <h1 className="text-xl font-bold text-[#111827] dark:text-[#F1F5F9] leading-snug">{title}</h1>
        {description && <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] leading-relaxed">{description}</p>}

        {/* Big prob display */}
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-4xl font-bold text-[#16A34A]">{yesPct}%</div>
            <div className="text-sm text-[#6B7280] dark:text-[#94A3B8] mt-1">{t('EVET ihtimali', 'YES chance')}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#DC2626] dark:text-red-400">{100 - yesPct}%</div>
            <div className="text-sm text-[#6B7280] dark:text-[#94A3B8] mt-1">{t('HAYIR ihtimali', 'NO chance')}</div>
          </div>
        </div>

        <div className="prob-bar" style={{ height: '8px' }}>
          <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
        </div>

        <div className="flex gap-6 text-sm text-[#6B7280] dark:text-[#94A3B8] pt-2 border-t border-[#F3F4F6] dark:border-[#334155]">
          <span>{t('Hacim', 'Volume')}: ◈{formatCredits(market.total_volume)}</span>
          <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
          <span>EVET {yesOdds}x · HAYIR {noOdds}x</span>
        </div>
      </div>

      {/* AI Favorites */}
      <AIFavorites favorites={getAIFavorites(market.id, yesProb)} />

      {/* Anonim kullanıcı: bahis için giriş CTA */}
      {market.status === 'active' && !userId && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-6 text-center flex flex-col gap-3 transition-colors duration-200">
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F1F5F9]">
            {t('Bu markete bahis yapmak ister misin?', 'Want to bet on this market?')}
          </h2>
          <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">
            {t('Ücretsiz kayıt ol, ◈1.000 kredi kazan, hemen tahmin yap.', 'Sign up free, get ◈1,000 credits, start predicting.')}
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/register" className="bg-[#16A34A] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#15803D] transition-colors">
              {t('Ücretsiz Başla', 'Start Free')}
            </a>
            <a href="/login" className="border border-[#E5E7EB] dark:border-[#334155] text-[#374151] dark:text-[#CBD5E1] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#F9FAFB] dark:hover:bg-[#0F172A] transition-colors">
              {t('Giriş Yap', 'Log in')}
            </a>
          </div>
        </div>
      )}

      {/* Bet panel */}
      {market.status === 'active' && !!userId && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-6 flex flex-col gap-5 transition-colors duration-200">
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F1F5F9]">{t('Bahis Yap', 'Place Bet')}</h2>

          {/* Side select */}
          <div className="grid grid-cols-2 gap-3">
            {(['yes', 'no'] as BetSide[]).map((side) => (
              <button key={side} onClick={() => setSelectedSide(side)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedSide === side
                    ? side === 'yes' ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#14532D]/40' : 'border-red-500 bg-red-50 dark:bg-red-950/40'
                    : 'border-[#E5E7EB] dark:border-[#334155] hover:border-[#D1D5DB] dark:hover:border-[#475569]'
                }`}>
                <div className={`text-lg font-bold ${side === 'yes' ? 'text-[#16A34A]' : 'text-red-500 dark:text-red-400'}`}>
                  {side === 'yes' ? t('EVET', 'YES') : t('HAYIR', 'NO')}
                </div>
                <div className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-1">
                  {side === 'yes' ? `${yesOdds}x · ${yesPct}%` : `${noOdds}x · ${100 - yesPct}%`}
                </div>
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] uppercase tracking-wider mb-2 block">
              {t('Miktar', 'Amount')} (◈ kredi)
            </label>
            <div className="flex gap-2">
              <input type="number" min={1} max={balance} value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="flex-1 bg-white dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] rounded-lg px-3 py-2.5 text-sm text-[#111827] dark:text-[#F1F5F9] outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all"
              />
              {[25, 50, 100, 250].map((p) => (
                <button key={p} onClick={() => setAmount(Math.min(p, balance))}
                  className="px-3 py-2 text-xs font-semibold border border-[#E5E7EB] dark:border-[#334155] rounded-lg hover:border-[#16A34A] hover:text-[#16A34A] text-[#6B7280] dark:text-[#94A3B8] transition-colors bg-white dark:bg-[#0F172A]">
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mt-1.5">{t('Bakiye', 'Balance')}: ◈{formatCredits(balance)}</p>
          </div>

          {/* Payout preview */}
          {selectedSide && (
            <div className="bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#F3F4F6] dark:border-[#334155] rounded-xl p-4 text-sm">
              <div className="flex justify-between text-[#6B7280] dark:text-[#94A3B8]">
                <span>{t('Risk', 'Risk')}</span><span>◈{formatCredits(amount)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280] dark:text-[#94A3B8] mt-1">
                <span>{t('Oran', 'Odds')}</span><span>{activeSideOdds}x</span>
              </div>
              <div className="flex justify-between font-bold text-[#16A34A] mt-2 pt-2 border-t border-[#E5E7EB] dark:border-[#334155]">
                <span>{t('Kazanç (kazanırsan)', 'Potential payout')}</span>
                <span>◈{formatCredits(potentialPayout)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-[#16A34A] font-medium">{success}</p>}

          <Button onClick={handlePlaceBet} disabled={!selectedSide || loading || amount <= 0 || amount > balance} size="lg" className="w-full">
            {loading ? t('İşleniyor...', 'Processing...') : t('Bahis Oyna', 'Place Bet')}
          </Button>
        </div>
      )}

      {market.status === 'resolved' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-4 text-center text-sm transition-colors duration-200">
          <span className="text-[#6B7280] dark:text-[#94A3B8]">{t('Sonuç', 'Outcome')}: </span>
          <span className={`font-bold ${market.outcome ? 'text-[#16A34A]' : 'text-red-500 dark:text-red-400'}`}>
            {market.outcome ? t('EVET', 'YES') : t('HAYIR', 'NO')}
          </span>
        </div>
      )}

      {/* User bets */}
      {userBets.length > 0 && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-5 flex flex-col gap-3 transition-colors duration-200">
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F1F5F9]">{t('Bahislerim', 'My Bets')}</h3>
          {userBets.map((bet) => (
            <div key={bet.id} className="flex items-center justify-between text-sm border-b border-[#F3F4F6] dark:border-[#334155] pb-2 last:border-0 last:pb-0">
              <span className={`font-bold ${bet.side === 'yes' ? 'text-[#16A34A]' : 'text-red-500 dark:text-red-400'}`}>{bet.side.toUpperCase()}</span>
              <span className="text-[#6B7280] dark:text-[#94A3B8]">◈{formatCredits(bet.amount)}</span>
              <span className="text-[#6B7280] dark:text-[#94A3B8]">{bet.odds_at_bet}x</span>
              <span className="text-[#9CA3AF] dark:text-[#64748B]">→ ◈{formatCredits(bet.potential_payout)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                bet.status === 'won' ? 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#16A34A]' :
                bet.status === 'lost' ? 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400' : 'bg-[#F9FAFB] dark:bg-[#0F172A] text-[#9CA3AF] dark:text-[#64748B]'
              }`}>
                {bet.status === 'won' ? t('KAZANDI', 'WON') : bet.status === 'lost' ? t('KAYBETTİ', 'LOST') : t('Bekliyor', 'Pending')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
