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
 * Son işlemler şeridi — borsa ekranı gibi. Supabase Realtime ile
 * yeni bahisler geldikçe canlı olarak başa eklenir.
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
        // Payload'da join yok — kullanıcı adı ve market başlığını çek
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

  return (
    <div className="tabela rounded-xl px-4 py-2.5 flex items-center gap-3 overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="live-dot" />
        <span className="tabela-label">{t('canlı', 'live')}</span>
      </div>
      <div className="flex gap-5 overflow-x-auto scrollbar-none min-w-0" style={{ scrollbarWidth: 'none' }}>
        {trades.map((tr) => (
          <Link
            key={tr.id}
            href={`/markets/${tr.markets?.id ?? ''}`}
            className="ticker-item flex items-center gap-1.5 shrink-0 text-[12px] hover:brightness-125 transition-all"
          >
            <span style={{ color: 'var(--board-text)' }}>@{tr.profiles?.username ?? '?'}</span>
            <span className={tr.side === 'no' ? 'tabela-fall' : 'tabela-rise'}>
              {tr.side ? (tr.side === 'yes' ? t('EVET', 'YES') : t('HAYIR', 'NO')) : t('SEÇİM', 'PICK')} ◈{formatCredits(tr.amount)}
            </span>
            <span className="max-w-[180px] truncate" style={{ color: 'var(--board-text)' }}>
              — {lang === 'tr' ? tr.markets?.title_tr : tr.markets?.title_en}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
