'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Market, Bet, BetSide } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { calculateOdds, calculatePayout } from '@/lib/odds';
import { categoryColor, categoryLabel, daysUntil, formatCredits, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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

  async function handlePlaceBet() {
    if (!selectedSide) return;
    if (amount <= 0 || amount > balance) {
      setError(t('Geçersiz miktar.', 'Invalid amount.'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    const supabase = createClient();

    const { error: betError } = await supabase.from('bets').insert({
      user_id: userId,
      market_id: market.id,
      side: selectedSide,
      amount,
      odds_at_bet: activeSideOdds,
      potential_payout: potentialPayout,
      status: 'pending',
    });

    if (betError) {
      setError(betError.message);
      setLoading(false);
      return;
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: balance - amount, total_bets: undefined })
      .eq('id', userId);

    if (!balanceError) {
      setBalance((b) => b - amount);
    }

    await supabase.rpc('increment_market_pool', {
      p_market_id: market.id,
      p_side: selectedSide,
      p_amount: amount,
    }).then(() => {});

    setSuccess(t(`◈${amount} kredi ile ${selectedSide.toUpperCase()} tarafına bahis yapıldı!`, `Bet placed: ◈${amount} on ${selectedSide.toUpperCase()}!`));
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Back */}
      <button onClick={() => router.back()} className="text-xs text-[#8892A4] hover:text-[#00FF88] transition-colors self-start">
        ← {t('Geri', 'Back')}
      </button>

      {/* Market header */}
      <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={categoryColor(market.category)}>{categoryLabel(market.category, lang)}</Badge>
          {market.tag && (
            <Badge className="bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30">{market.tag}</Badge>
          )}
          <span className="text-xs text-[#8892A4]">{market.region === 'turkey' ? '🇹🇷 Türkiye' : '🌐 Global'}</span>
          <span className={`ml-auto text-xs ${daysUntil(market.ends_at) <= 7 ? 'text-red-400' : 'text-[#8892A4]'}`}>
            {t('Bitiş', 'Ends')}: {formatDate(market.ends_at, lang)}
          </span>
        </div>

        <h1 className="text-base font-bold text-[#F0F2F5] leading-snug">{title}</h1>
        {description && <p className="text-xs text-[#8892A4] leading-relaxed">{description}</p>}

        {/* Prob */}
        <div>
          <div className="prob-bar h-2">
            <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-sm font-bold">
            <span className="text-[#00FF88]">YES {yesPct}%</span>
            <span className="text-red-400">NO {100 - yesPct}%</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-xs text-[#8892A4] border-t border-[#1E2130] pt-3">
          <span>{t('Hacim', 'Volume')}: ◈{formatCredits(market.total_volume)}</span>
          <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
          <span>YES {yesOdds}x · NO {noOdds}x</span>
        </div>
      </div>

      {/* Bet panel */}
      {market.status === 'active' && (
        <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-[#F0F2F5]">{t('Bahis Yap', 'Place Bet')}</h2>

          {/* Side selection */}
          <div className="grid grid-cols-2 gap-3">
            {(['yes', 'no'] as BetSide[]).map((side) => (
              <button
                key={side}
                onClick={() => setSelectedSide(side)}
                className={`p-4 rounded border-2 transition-all ${
                  selectedSide === side
                    ? side === 'yes'
                      ? 'border-[#00FF88] bg-[#00FF88]/10'
                      : 'border-red-500 bg-red-500/10'
                    : 'border-[#1E2130] hover:border-[#8892A4]'
                }`}
              >
                <div className={`text-base font-bold ${side === 'yes' ? 'text-[#00FF88]' : 'text-red-400'}`}>
                  {side.toUpperCase()}
                </div>
                <div className="text-xs text-[#8892A4] mt-1">
                  {side === 'yes' ? yesOdds : noOdds}x · {side === 'yes' ? yesPct : 100 - yesPct}%
                </div>
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs text-[#8892A4] uppercase tracking-wider mb-1.5 block">
              {t('Miktar', 'Amount')} (◈{t('kredi', 'credits')})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="flex-1 bg-[#0F1117] border border-[#1E2130] rounded px-3 py-2 text-sm text-[#F0F2F5] outline-none focus:border-[#00FF88] transition-colors font-mono"
              />
              <div className="flex gap-1">
                {[25, 50, 100, 200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(Math.min(preset, balance))}
                    className="px-2 py-1 text-xs border border-[#1E2130] rounded hover:border-[#00FF88] text-[#8892A4] hover:text-[#00FF88] transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[#4B5563] mt-1">
              {t('Bakiye', 'Balance')}: ◈{formatCredits(balance)}
            </p>
          </div>

          {/* Payout preview */}
          {selectedSide && (
            <div className="bg-[#0F1117] border border-[#1E2130] rounded p-3 text-xs">
              <div className="flex justify-between text-[#8892A4]">
                <span>{t('Miktar', 'Amount')}</span>
                <span>◈{formatCredits(amount)}</span>
              </div>
              <div className="flex justify-between text-[#8892A4] mt-1">
                <span>{t('Oran', 'Odds')}</span>
                <span>{activeSideOdds}x</span>
              </div>
              <div className="flex justify-between font-bold text-[#00FF88] mt-2 border-t border-[#1E2130] pt-2">
                <span>{t('Kazanç (kazanırsan)', 'Potential payout')}</span>
                <span>◈{formatCredits(potentialPayout)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-[#00FF88]">{success}</p>}

          <Button
            onClick={handlePlaceBet}
            disabled={!selectedSide || loading || amount <= 0 || amount > balance}
            size="lg"
            className="w-full"
          >
            {loading ? t('İşleniyor...', 'Processing...') : t('Bahis Oyna', 'Place Bet')}
          </Button>
        </div>
      )}

      {market.status === 'resolved' && (
        <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-4 text-sm text-center">
          <span className="text-[#8892A4]">{t('Sonuç', 'Outcome')}: </span>
          <span className={market.outcome ? 'text-[#00FF88] font-bold' : 'text-red-400 font-bold'}>
            {market.outcome ? 'YES' : 'NO'}
          </span>
        </div>
      )}

      {/* User's bets on this market */}
      {userBets.length > 0 && (
        <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#F0F2F5]">{t('Bahislerim', 'My Bets')}</h3>
          {userBets.map((bet) => (
            <div key={bet.id} className="flex items-center justify-between text-xs border-b border-[#1E2130] pb-2 last:border-0 last:pb-0">
              <span className={bet.side === 'yes' ? 'text-[#00FF88]' : 'text-red-400'}>{bet.side.toUpperCase()}</span>
              <span className="text-[#8892A4]">◈{formatCredits(bet.amount)}</span>
              <span className="text-[#8892A4]">{bet.odds_at_bet}x → ◈{formatCredits(bet.potential_payout)}</span>
              <span className={`${bet.status === 'won' ? 'text-[#00FF88]' : bet.status === 'lost' ? 'text-red-400' : 'text-[#8892A4]'}`}>
                {bet.status === 'won' ? t('KAZANDI', 'WON') : bet.status === 'lost' ? t('KAYBETTİ', 'LOST') : t('Bekliyor', 'Pending')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
