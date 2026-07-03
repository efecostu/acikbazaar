'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Market, MarketOption, Bet, BetSide } from '@/types';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { calculateOdds, calculatePayout } from '@/lib/odds';
import { categoryColor, categoryLabel, daysUntil, formatCredits, formatDate, getAIFavorites } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AIFavorites } from '@/components/AIFavorites';
import { ProbChart, ProbPoint } from '@/components/ProbChart';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { celebrate } from '@/lib/confetti';

interface BetWithOption extends Bet {
  market_options?: { label_tr: string; label_en: string } | null;
}

interface Props {
  market: Market;
  balance: number;
  userId: string;
  userBets: BetWithOption[];
  options?: MarketOption[];
  history?: ProbPoint[];
}

const OPTION_COLORS = ['#2FD588', '#5B9BFF', '#F5B23D', '#FF7A70', '#C792EA', '#6BD5E1'];

export function MarketDetailClient({ market, balance: initialBalance, userId, userBets, options = [], history = [] }: Props) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [amount, setAmount] = useState(100);
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const betBtnRef = useRef<HTMLButtonElement>(null);

  // Canlı market verisi — Realtime ile başkalarının bahisleri anında yansır
  const [live, setLive] = useState({
    yes_pool: market.yes_pool,
    no_pool: market.no_pool,
    total_volume: market.total_volume,
    participant_count: market.participant_count,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`market-${market.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${market.id}` },
        (payload) => {
          const m = payload.new as typeof live;
          setLive({
            yes_pool: m.yes_pool, no_pool: m.no_pool,
            total_volume: m.total_volume, participant_count: m.participant_count,
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [market.id]);

  const isMulti = market.kind === 'multi' && options.length > 0;
  const title = lang === 'tr' ? market.title_tr : market.title_en;
  const description = lang === 'tr' ? market.description_tr : market.description_en;

  // Binary oranlar (canlı havuzlardan)
  const { yesProb, noProb, yesOdds, noOdds } = calculateOdds(live.yes_pool, live.no_pool);
  const yesPct = Math.round(yesProb * 100);

  // Multi oranlar
  const totalOptionPool = options.reduce((s, o) => s + o.pool, 0);
  const optionProb = (o: MarketOption) =>
    totalOptionPool === 0
      ? 1 / Math.max(options.length, 2)
      : Math.max(0.02, Math.min(0.98, (o.pool / totalOptionPool) * 0.97));
  const sortedOptions = [...options].sort((a, b) => b.pool - a.pool || a.sort - b.sort);
  const optionColor = (id: string) => OPTION_COLORS[options.findIndex((o) => o.id === id) % OPTION_COLORS.length];
  const activeOption = options.find((o) => o.id === selectedOption);

  const activeProb = isMulti
    ? (activeOption ? optionProb(activeOption) : 0)
    : (selectedSide === 'yes' ? yesProb : noProb);
  const activeOdds = activeProb > 0 ? parseFloat((1 / activeProb).toFixed(2)) : 0;
  const canBet = isMulti ? !!selectedOption : !!selectedSide;
  const potentialPayout = canBet ? calculatePayout(amount, activeProb) : 0;

  const BET_ERRORS: Record<string, [string, string]> = {
    insufficient_balance: ['Yetersiz bakiye.', 'Insufficient balance.'],
    market_closed: ['Market kapandı, bahis alınamıyor.', 'Market is closed.'],
    market_not_found: ['Market bulunamadı.', 'Market not found.'],
    option_not_found: ['Seçenek bulunamadı.', 'Option not found.'],
    invalid_amount: ['Geçersiz miktar.', 'Invalid amount.'],
    auth_required: ['Giriş yapmalısın.', 'You must be logged in.'],
  };

  async function handlePlaceBet() {
    if (!canBet) return;
    if (amount <= 0 || amount > balance) { setError(t('Geçersiz miktar.', 'Invalid amount.')); return; }
    setLoading(true); setError(''); setSuccess('');
    const supabase = createClient();
    const { data, error: betError } = isMulti
      ? await supabase.rpc('place_bet_option', { p_market_id: market.id, p_option_id: selectedOption, p_amount: amount })
      : await supabase.rpc('place_bet', { p_market_id: market.id, p_side: selectedSide, p_amount: amount });
    if (betError) {
      const known = Object.keys(BET_ERRORS).find((k) => betError.message.includes(k));
      setError(known ? t(...BET_ERRORS[known]) : betError.message);
      setLoading(false);
      return;
    }
    setBalance(data?.new_balance ?? balance - amount);
    const picked = isMulti
      ? (lang === 'tr' ? activeOption?.label_tr : activeOption?.label_en)
      : selectedSide?.toUpperCase();
    let msg = t(`◈${formatCredits(amount)} — "${picked}" için bahis yapıldı!`, `Bet placed: ◈${formatCredits(amount)} on "${picked}"!`);
    if (data?.streak_bonus > 0) {
      msg += t(` 🔥 ${data.streak}. gün streak — ◈${formatCredits(data.streak_bonus)} bonus!`, ` 🔥 Day ${data.streak} streak — ◈${formatCredits(data.streak_bonus)} bonus!`);
    }
    setSuccess(msg);
    celebrate(betBtnRef.current);
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

        {/* Kotasyon panosu */}
        {isMulti ? (
          <div className="tabela px-6 py-5 flex flex-col gap-3">
            {sortedOptions.map((o) => {
              const p = optionProb(o);
              const pct = Math.round(p * 100);
              const color = optionColor(o.id);
              const won = market.status === 'resolved' && market.winning_option_id === o.id;
              return (
                <div key={o.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium" style={{ color }}>
                      {lang === 'tr' ? o.label_tr : o.label_en}
                      {won && ' ✓'}
                    </span>
                    <span className="text-sm font-medium" style={{ color }}>
                      {pct}% <span className="opacity-70 text-xs">· {(1 / p).toFixed(2)}x</span>
                    </span>
                  </div>
                  <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--board-line)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between mt-1 text-[11px]" style={{ color: 'var(--board-text)' }}>
              <span>◈{formatCredits(market.total_volume)} {t('hacim', 'volume')}</span>
              <span>{market.participant_count} {t('katılımcı', 'traders')}</span>
            </div>
          </div>
        ) : (
          <div className="tabela px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="tabela-label mb-1.5">{t('evet', 'yes')}</div>
                <div className="tabela-rise text-[40px] font-semibold leading-none">
                  <AnimatedNumber value={yesPct} /><span className="text-[22px]">%</span>
                </div>
                <div className="text-[13px] mt-1.5 opacity-80">
                  <span className="tabela-rise"><AnimatedNumber value={yesOdds} format={(v) => v.toFixed(2)} />x</span>
                </div>
              </div>
              <div className="tabela-divider w-px self-stretch mx-4" />
              <div className="text-right">
                <div className="tabela-label mb-1.5">{t('hayır', 'no')}</div>
                <div className="tabela-fall text-[40px] font-semibold leading-none">
                  <AnimatedNumber value={100 - yesPct} /><span className="text-[22px]">%</span>
                </div>
                <div className="text-[13px] mt-1.5 opacity-80">
                  <span className="tabela-fall"><AnimatedNumber value={noOdds} format={(v) => v.toFixed(2)} />x</span>
                </div>
              </div>
            </div>
            <div className="mt-4 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--board-line)' }}>
              <div className="h-full rounded-full" style={{ width: `${yesPct}%`, background: 'var(--rise-bright)', transition: 'width 0.4s ease' }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-[11px]" style={{ color: 'var(--board-text)' }}>
              <span>◈<AnimatedNumber value={live.total_volume} format={formatCredits} flash={false} /> {t('hacim', 'volume')}</span>
              <span><AnimatedNumber value={live.participant_count} flash={false} /> {t('katılımcı', 'traders')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Olasılık grafiği — en az 2 nokta varsa */}
      {!isMulti && history.length >= 2 && (
        <ProbChart points={history} currentProb={yesProb} />
      )}

      {/* AI Favorites — sadece binary */}
      {!isMulti && <AIFavorites favorites={getAIFavorites(market.id, yesProb)} />}

      {/* Anonim kullanıcı: bahis için giriş CTA */}
      {market.status === 'active' && !userId && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center flex flex-col gap-3 transition-colors duration-200">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            {t('Sen olsan ne derdin?', 'What would you say?')}
          </h2>
          <p className="text-sm text-[var(--ink-2)]">
            {t('Ücretsiz kayıt ol, ◈100.000 kredin hazır — tahminini koy.', 'Sign up free, get ◈100,000 credits, make your call.')}
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

          {/* Seçim */}
          {isMulti ? (
            <div className="flex flex-col gap-2">
              {sortedOptions.map((o) => {
                const p = optionProb(o);
                const color = optionColor(o.id);
                const active = selectedOption === o.id;
                return (
                  <button key={o.id} onClick={() => setSelectedOption(o.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left ${
                      active ? 'bg-[var(--surface-2)]' : 'border-[var(--border)] hover:border-[var(--ink-3)]'
                    }`}
                    style={active ? { borderColor: color } : undefined}>
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      {lang === 'tr' ? o.label_tr : o.label_en}
                    </span>
                    <span className="font-data text-xs text-[var(--ink-2)]">
                      {Math.round(p * 100)}% · {(1 / p).toFixed(2)}x
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
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
          )}

          {/* Miktar */}
          <div>
            <label className="text-xs font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-2 block">
              {t('Miktar', 'Amount')} (◈ kredi)
            </label>
            <div className="flex gap-2">
              <input type="number" min={1} max={balance} value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="font-data flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all"
              />
              {[100, 500, 1000, 5000].map((p) => (
                <button key={p} onClick={() => setAmount(Math.min(p, balance))}
                  className="font-data px-3 py-2 text-xs font-medium border border-[var(--border)] rounded-lg hover:border-[var(--rise)] hover:text-[var(--rise)] text-[var(--ink-2)] transition-colors bg-[var(--surface)]">
                  {p >= 1000 ? `${p / 1000}K` : p}
                </button>
              ))}
            </div>
            <p className="font-data text-xs text-[var(--ink-3)] mt-1.5">{t('Bakiye', 'Balance')}: ◈{formatCredits(balance)}</p>
          </div>

          {/* Kazanç önizleme */}
          {canBet && (
            <div className="bg-[var(--surface-2)] border border-[var(--border-light)] rounded-xl p-4 text-sm">
              <div className="flex justify-between text-[var(--ink-2)]">
                <span>{t('Risk', 'Risk')}</span><span className="font-data">◈{formatCredits(amount)}</span>
              </div>
              <div className="flex justify-between text-[var(--ink-2)] mt-1">
                <span>{t('Oran', 'Odds')}</span><span className="font-data">{activeOdds}x</span>
              </div>
              <div className="flex justify-between font-bold text-[var(--rise)] mt-2 pt-2 border-t border-[var(--border)]">
                <span>{t('Kazanç (kazanırsan)', 'Potential payout')}</span>
                <span className="font-data">◈{formatCredits(potentialPayout)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[var(--fall)]">{error}</p>}
          {success && <p className="text-sm text-[var(--rise)] font-medium">{success}</p>}

          <Button ref={betBtnRef} onClick={handlePlaceBet} disabled={!canBet || loading || amount <= 0 || amount > balance} size="lg" className="w-full">
            {loading ? t('İşleniyor...', 'Processing...') : t('Tahminini Onayla', 'Confirm Bet')}
          </Button>
        </div>
      )}

      {market.status === 'resolved' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center text-sm">
          <span className="text-[var(--ink-2)]">{t('Sonuç', 'Outcome')}: </span>
          <span className={`font-bold ${isMulti || market.outcome ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>
            {isMulti
              ? (lang === 'tr'
                  ? options.find((o) => o.id === market.winning_option_id)?.label_tr
                  : options.find((o) => o.id === market.winning_option_id)?.label_en) ?? '—'
              : market.outcome ? t('EVET', 'YES') : t('HAYIR', 'NO')}
          </span>
        </div>
      )}

      {/* User bets */}
      {userBets.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[var(--ink)]">{t('Bahislerim', 'My Bets')}</h3>
          {userBets.map((bet) => {
            const pick = bet.side
              ? bet.side.toUpperCase()
              : (lang === 'tr' ? bet.market_options?.label_tr : bet.market_options?.label_en) ?? '—';
            return (
              <div key={bet.id} className="flex items-center justify-between gap-2 text-sm border-b border-[var(--border-light)] pb-2 last:border-0 last:pb-0">
                <span className={`font-bold truncate max-w-[120px] ${bet.side === 'no' ? 'text-[var(--fall)]' : 'text-[var(--rise)]'}`}>{pick}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
