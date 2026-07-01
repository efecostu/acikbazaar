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
      <button onClick={() => router.back()} className="text-sm text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors self-start flex items-center gap-1">
        ← {t('Geri', 'Back')}
      </button>

      {/* Market info */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-colors duration-200">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge color={categoryColor(market.category)}>{categoryLabel(market.category, lang)}</Badge>
              {market.tag && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--copper-soft)] text-[var(--copper)] border border-[var(--copper-line)]">
                  {market.tag}
                </span>
              )}
              <span className="text-xs text-[var(--ink-3)]">{market.region === 'turkey' ? '🇹🇷' : '🌐'}</span>
            </div>
            <span className={`font-data text-xs ${daysUntil(market.ends_at) <= 7 ? 'text-[var(--fall)]' : 'text-[var(--ink-3)]'}`}>
              {t('Bitiş', 'Ends')}: {formatDate(market.ends_at, lang)}
            </span>
          </div>

          <h1 className="font-display text-[22px] font-bold text-[var(--ink)] leading-snug">{title}</h1>
          {description && <p className="text-sm text-[var(--ink-2)] leading-relaxed">{description}</p>}
        </div>

        {/* Kotasyon panosu — imzanın büyük hali */}
        <div className="tabela px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="tabela-label mb-1.5">{t('evet', 'yes')}</div>
              <div className="tabela-rise text-[40px] font-semibold leading-none">
                {yesPct}<span className="text-[22px]">%</span>
              </div>
              <div className="text-[13px] mt-1.5 opacity-80">
                <span className="tabela-rise">{yesOdds.toFixed(2)}x</span>
              </div>
            </div>
            <div className="tabela-divider w-px self-stretch mx-4" />
            <div className="text-right">
              <div className="tabela-label mb-1.5">{t('hayır', 'no')}</div>
              <div className="tabela-fall text-[40px] font-semibold leading-none">
                {100 - yesPct}<span className="text-[22px]">%</span>
              </div>
              <div className="text-[13px] mt-1.5 opacity-80">
                <span className="tabela-fall">{noOdds.toFixed(2)}x</span>
              </div>
            </div>
          </div>
          <div className="mt-4 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--board-line)' }}>
            <div className="h-full rounded-full" style={{ width: `${yesPct}%`, background: 'var(--rise-bright)', transition: 'width 0.4s ease' }} />
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px]" style={{ color: 'var(--board-text)' }}>
            <span>◈{formatCredits(market.total_volume)} {t('hacim', 'volume')}</span>
            <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
          </div>
        </div>
      </div>

      {/* AI Favorites */}
      <AIFavorites favorites={getAIFavorites(market.id, yesProb)} />

      {/* Anonim kullanıcı: bahis için giriş CTA */}
      {market.status === 'active' && !userId && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center flex flex-col gap-3 transition-colors duration-200">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            {t('Sen olsan ne derdin?', 'What would you say?')}
          </h2>
          <p className="text-sm text-[var(--ink-2)]">
            {t('Ücretsiz kayıt ol, ◈1.000 kredin hazır — tahminini koy.', 'Sign up free, get ◈1,000 credits, make your call.')}
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/register" className="bg-[var(--rise)] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:brightness-110 transition-all">
              {t('Ücretsiz Başla', 'Start Free')}
            </a>
            <a href="/login" className="border border-[var(--border)] text-[var(--ink)] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
              {t('Giriş Yap', 'Log in')}
            </a>
          </div>
        </div>
      )}

      {/* Bet panel */}
      {market.status === 'active' && !!userId && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5 transition-colors duration-200">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t('Tahminini Koy', 'Place Your Bet')}</h2>

          {/* Side select */}
          <div className="grid grid-cols-2 gap-3">
            {(['yes', 'no'] as BetSide[]).map((side) => (
              <button key={side} onClick={() => setSelectedSide(side)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedSide === side
                    ? side === 'yes' ? 'border-[var(--rise)] bg-[var(--rise-soft)]' : 'border-[var(--fall)] bg-[var(--fall-soft)]'
                    : 'border-[var(--border)] hover:border-[var(--ink-3)]'
                }`}>
                <div className={`text-lg font-bold ${side === 'yes' ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>
                  {side === 'yes' ? t('EVET', 'YES') : t('HAYIR', 'NO')}
                </div>
                <div className="font-data text-xs text-[var(--ink-2)] mt-1">
                  {side === 'yes' ? `${yesOdds}x · ${yesPct}%` : `${noOdds}x · ${100 - yesPct}%`}
                </div>
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-2 block">
              {t('Miktar', 'Amount')} (◈ kredi)
            </label>
            <div className="flex gap-2">
              <input type="number" min={1} max={balance} value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="font-data flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all"
              />
              {[25, 50, 100, 250].map((p) => (
                <button key={p} onClick={() => setAmount(Math.min(p, balance))}
                  className="font-data px-3 py-2 text-xs font-medium border border-[var(--border)] rounded-lg hover:border-[var(--rise)] hover:text-[var(--rise)] text-[var(--ink-2)] transition-colors bg-[var(--surface)]">
                  {p}
                </button>
              ))}
            </div>
            <p className="font-data text-xs text-[var(--ink-3)] mt-1.5">{t('Bakiye', 'Balance')}: ◈{formatCredits(balance)}</p>
          </div>

          {/* Payout preview */}
          {selectedSide && (
            <div className="bg-[var(--surface-2)] border border-[var(--border-light)] rounded-xl p-4 text-sm">
              <div className="flex justify-between text-[var(--ink-2)]">
                <span>{t('Risk', 'Risk')}</span><span className="font-data">◈{formatCredits(amount)}</span>
              </div>
              <div className="flex justify-between text-[var(--ink-2)] mt-1">
                <span>{t('Oran', 'Odds')}</span><span className="font-data">{activeSideOdds}x</span>
              </div>
              <div className="flex justify-between font-bold text-[var(--rise)] mt-2 pt-2 border-t border-[var(--border)]">
                <span>{t('Kazanç (kazanırsan)', 'Potential payout')}</span>
                <span className="font-data">◈{formatCredits(potentialPayout)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[var(--fall)]">{error}</p>}
          {success && <p className="text-sm text-[var(--rise)] font-medium">{success}</p>}

          <Button onClick={handlePlaceBet} disabled={!selectedSide || loading || amount <= 0 || amount > balance} size="lg" className="w-full">
            {loading ? t('İşleniyor...', 'Processing...') : t('Tahminini Onayla', 'Confirm Bet')}
          </Button>
        </div>
      )}

      {market.status === 'resolved' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center text-sm">
          <span className="text-[var(--ink-2)]">{t('Sonuç', 'Outcome')}: </span>
          <span className={`font-bold ${market.outcome ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>
            {market.outcome ? t('EVET', 'YES') : t('HAYIR', 'NO')}
          </span>
        </div>
      )}

      {/* User bets */}
      {userBets.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[var(--ink)]">{t('Bahislerim', 'My Bets')}</h3>
          {userBets.map((bet) => (
            <div key={bet.id} className="flex items-center justify-between text-sm border-b border-[var(--border-light)] pb-2 last:border-0 last:pb-0">
              <span className={`font-bold ${bet.side === 'yes' ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>{bet.side.toUpperCase()}</span>
              <span className="font-data text-[var(--ink-2)]">◈{formatCredits(bet.amount)}</span>
              <span className="font-data text-[var(--ink-2)]">{bet.odds_at_bet}x</span>
              <span className="font-data text-[var(--ink-3)]">→ ◈{formatCredits(bet.potential_payout)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                bet.status === 'won' ? 'bg-[var(--rise-soft)] text-[var(--rise)]' :
                bet.status === 'lost' ? 'bg-[var(--fall-soft)] text-[var(--fall)]' : 'bg-[var(--surface-2)] text-[var(--ink-3)]'
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
