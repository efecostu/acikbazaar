'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import { calculateOdds } from '@/lib/odds';
import { formatCredits } from '@/lib/utils';
import type { Market } from '@/types';

interface Props {
  markets: Market[];
  linkTo?: string;
}

/**
 * Hero'nun sağındaki "döviz tabelası": en hacimli marketlerin canlı kotasyonu.
 * Yükleme anında barlar sıfırdan dolar; satırlar kademeli belirir.
 */
export function HeroBoard({ markets, linkTo }: Props) {
  const { lang, t } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const rows = markets.slice(0, 5);
  if (rows.length === 0) return null;

  return (
    <div className="tabela rounded-2xl overflow-hidden shadow-[0_24px_60px_-24px_rgba(12,31,22,0.55)] border border-[var(--board-line)]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--board-line)]">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="tabela-label">{t('canlı kotasyon', 'live quotes')}</span>
        </div>
        <span className="tabela-label">{t('evet · hayır', 'yes · no')}</span>
      </div>

      <ul className="divide-y divide-[var(--board-line)]">
        {rows.map((m, i) => {
          const { yesProb, yesOdds, noOdds } = calculateOdds(m.yes_pool, m.no_pool);
          const pct = Math.round(yesProb * 100);
          const title = lang === 'tr' ? m.title_tr : m.title_en;
          const href = linkTo ?? `/markets/${m.id}`;
          return (
            <li key={m.id} className="hero-row" style={{ animationDelay: `${120 + i * 70}ms` }}>
              <Link href={href} className="block px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[13px] leading-snug text-white/90 line-clamp-2 [font-family:var(--font-body)] font-medium">
                    {title}
                  </span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    <span className="tabela-rise text-sm font-medium">{yesOdds.toFixed(2)}</span>
                    <span className="tabela-fall text-sm font-medium">{noOdds.toFixed(2)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="h-[4px] flex-1 rounded-full overflow-hidden" style={{ background: 'var(--board-line)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: mounted ? `${pct}%` : '0%',
                        background: 'var(--rise-bright)',
                        transition: `width 900ms cubic-bezier(0.16,1,0.3,1) ${200 + i * 70}ms`,
                      }}
                    />
                  </div>
                  <span className="tabela-rise text-[12px] w-9 text-right">{pct}%</span>
                  <span className="text-[10px] w-16 text-right" style={{ color: 'var(--board-text)' }}>◈{formatCredits(m.total_volume)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href="/markets" className="flex items-center justify-between px-5 py-3 border-t border-[var(--board-line)] hover:bg-white/[0.03] transition-colors">
        <span className="tabela-label">{t('tüm marketler', 'all markets')}</span>
        <span className="tabela-rise text-xs">→</span>
      </Link>
    </div>
  );
}
