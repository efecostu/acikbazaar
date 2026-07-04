'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { formatCredits } from '@/lib/utils';

export interface TradeRow {
  id: string;
  side: 'yes' | 'no' | null;
  amount: number;
  created_at: string;
  profiles: { username: string; is_bot: boolean } | null;
  markets: { id: string; title_tr: string; title_en: string } | null;
}

interface Props {
  initialTrades: TradeRow[];
}

/**
 * Son işlemler bandı — borsa ekranı gibi sürekli kayar, hover'da durur.
 * Supabase Realtime ile yeni bahisler canlı eklenir.
 */
export function LiveTicker({ initialTrades }: Props) {
  const { lang, t } = useLang();
  const [trades, setTrades] = useState<TradeRow[]>(initialTrades);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('live-trades')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bets' }, async (payload) => {
        const bet = payload.new as { id: string; side: 'yes' | 'no' | null; amount: number; created_at: string; user_id: string; market_id: string };
        const [{ data: profile }, { data: market }] = await Promise.all([
          supabase.from('profiles').select('username, is_bot').eq('id', bet.user_id).single(),
          supabase.from('markets').select('id, title_tr, title_en').eq('id', bet.market_id).single(),
        ]);
        setTrades((prev) => [
          { id: bet.id, side: bet.side, amount: bet.amount, created_at: bet.created_at, profiles: profile, markets: market },
          ...prev,
        ].slice(0, 12));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (trades.length === 0) return null;

  // Kesintisiz döngü için içerik iki kez basılır; ikinci kopya ekran okuyucudan gizli
  const renderItems = (ariaHidden: boolean) =>
    trades.map((tr) => (
      <Link
        key={`${ariaHidden ? 'dup-' : ''}${tr.id}`}
        aria-hidden={ariaHidden || undefined}
        tabIndex={ariaHidden ? -1 : undefined}
        href={`/markets/${tr.markets?.id ?? ''}`}
        className="flex items-center gap-1.5 shrink-0 text-[12px] hover:brightness-125 transition-all"
      >
        <span style={{ color: 'var(--board-text)' }}>@{tr.profiles?.username ?? '?'}</span>
        <span className={tr.side === 'no' ? 'tabela-fall' : 'tabela-rise'}>
          {tr.side ? (tr.side === 'yes' ? t('EVET', 'YES') : t('HAYIR', 'NO')) : t('SEÇİM', 'PICK')} ◈{formatCredits(tr.amount)}
        </span>
        <span className="max-w-[200px] truncate" style={{ color: 'var(--board-text)' }}>
          — {lang === 'tr' ? tr.markets?.title_tr : tr.markets?.title_en}
        </span>
        <span className="mx-3 opacity-40" style={{ color: 'var(--board-text)' }}>·</span>
      </Link>
    ));

  return (
    <div className="tabela rounded-xl pl-4 pr-0 py-2.5 flex items-center gap-3 overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-[var(--board-line)]">
        <span className="live-dot" />
        <span className="tabela-label">{t('canlı', 'live')}</span>
      </div>
      <div className="marquee min-w-0 flex-1">
        <div className="marquee-track" style={{ animationDuration: `${Math.max(trades.length * 5, 25)}s` }}>
          {renderItems(false)}
          {renderItems(true)}
        </div>
      </div>
    </div>
  );
}
