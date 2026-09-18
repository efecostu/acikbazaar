'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, User } from 'lucide-react';
import { useLang } from '@/contexts/LangContext';
import { cn, formatCredits } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';

export interface ActivityRow {
  id: string;
  side: 'yes' | 'no' | null;
  amount: number;
  odds: number;
  payout: number;
  status: string;
  created_at: string;
  username: string;
  is_bot: boolean;
  market_id: string;
  title_tr: string;
  title_en: string;
  category: string;
  yes_prob: number;
}

type Filter = 'all' | 'humans' | 'bots' | 'big';

// Başlık ve satırlar aynı kolon şablonunu kullanır
const COLS = 'grid-cols-[4rem_minmax(0,1fr)_5.5rem] sm:grid-cols-[5rem_8.5rem_minmax(0,1fr)_4.5rem_6rem_5rem]';

function timeAgo(iso: string, lang: 'tr' | 'en'): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return lang === 'tr' ? 'şimdi' : 'now';
  if (m < 60) return lang === 'tr' ? `${m} dk` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'tr' ? `${h} sa` : `${h}h`;
  return lang === 'tr' ? `${Math.floor(h / 24)} g` : `${Math.floor(h / 24)}d`;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
}

export function ActivityClient({ rows }: { rows: ActivityRow[] }) {
  const { lang, t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter === 'humans') return !r.is_bot;
    if (filter === 'bots') return r.is_bot;
    if (filter === 'big') return r.amount >= 5000;
    return true;
  }), [rows, filter]);

  const stats = useMemo(() => {
    const dayAgo = Date.now() - 864e5;
    const last24 = rows.filter((r) => new Date(r.created_at).getTime() > dayAgo);
    return {
      count24: last24.length,
      volume24: last24.reduce((s, r) => s + r.amount, 0),
      humans24: last24.filter((r) => !r.is_bot).length,
    };
  }, [rows]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('Hepsi', 'All') },
    { key: 'humans', label: t('Kullanıcılar', 'Users') },
    { key: 'bots', label: t('Botlar', 'Bots') },
    { key: 'big', label: t('Büyük (5K+)', 'Big (5K+)') },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[var(--ink)]">{t('Akış', 'Activity')}</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            {t('Son bahisler — kim, ne zaman, hangi market, ne kadar.', 'Latest bets — who, when, which market, how much.')}
          </p>
        </div>
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                filter === f.key
                  ? 'border-[var(--rise)] text-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--ink-3)] bg-[var(--surface)]')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Son 24 saat özeti */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('bahis / 24 sa', 'bets / 24h'), value: stats.count24.toLocaleString('tr-TR') },
          { label: t('hacim / 24 sa', 'volume / 24h'), value: `◈${formatCredits(stats.volume24)}` },
          { label: t('kullanıcı bahsi / 24 sa', 'user bets / 24h'), value: stats.humans24.toLocaleString('tr-TR') },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="font-data text-lg font-semibold text-[var(--ink)]">{s.value}</div>
            <div className="tabela-label mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden transition-colors duration-200">
        <div className={`tabela grid ${COLS} gap-3 px-5 py-2.5 items-center`}>
          <span className="tabela-label">{t('saat', 'time')}</span>
          <span className="tabela-label hidden sm:block">{t('kim', 'who')}</span>
          <span className="tabela-label">{t('market', 'market')}</span>
          <span className="tabela-label hidden sm:block text-right">{t('taraf', 'side')}</span>
          <span className="tabela-label text-right">{t('miktar', 'amount')}</span>
          <span className="tabela-label hidden sm:block text-right">{t('oran', 'odds')}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--ink-2)]">{t('Henüz bahis yok.', 'No bets yet.')}</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((r) => (
              <li key={r.id} className={`grid ${COLS} gap-3 px-5 py-3 items-center hover:bg-[var(--surface-2)] transition-colors`}>
                <div className="flex flex-col leading-tight">
                  <span className="font-data text-xs text-[var(--ink)]">{clock(r.created_at)}</span>
                  <span className="font-data text-[10px] text-[var(--ink-3)]">{timeAgo(r.created_at, lang)}</span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                  {r.is_bot
                    ? <Bot size={13} className="text-[var(--ink-3)] shrink-0" aria-label={t('bot', 'bot')} />
                    : <User size={13} className="text-[var(--rise)] shrink-0" aria-label={t('kullanıcı', 'user')} />}
                  <span className={cn('text-sm truncate', r.is_bot ? 'text-[var(--ink-2)]' : 'text-[var(--ink)] font-medium')}>
                    {r.username}
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon category={r.category} size={13} className="text-[var(--ink-3)] shrink-0" />
                  <Link href={`/markets/${r.market_id}`} className="text-sm text-[var(--ink)] truncate hover:underline">
                    {lang === 'tr' ? r.title_tr : r.title_en}
                  </Link>
                  <span className="sm:hidden text-[10px] text-[var(--ink-3)] shrink-0">
                    {r.is_bot ? '· bot' : `· ${r.username}`}
                  </span>
                </div>

                <div className="hidden sm:block text-right">
                  {r.side && (
                    <span className={cn('inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide',
                      r.side === 'yes' ? 'bg-[var(--rise-soft)] text-[var(--rise)]' : 'bg-[var(--fall-soft)] text-[var(--fall)]')}>
                      {r.side === 'yes' ? t('EVET', 'YES') : t('HAYIR', 'NO')}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className={cn('font-data font-semibold text-sm', r.amount >= 5000 ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]')}>
                    ◈{formatCredits(r.amount)}
                  </span>
                  <span className="sm:hidden block text-[10px] font-data text-[var(--ink-3)]">
                    {r.side === 'yes' ? t('EVET', 'YES') : r.side === 'no' ? t('HAYIR', 'NO') : ''}
                  </span>
                </div>

                <div className="hidden sm:block text-right font-data text-xs text-[var(--ink-2)]">
                  {r.odds.toFixed(2)}x
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
