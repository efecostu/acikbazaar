'use client';

import { useEffect, useRef, useState } from 'react';

interface HeroMarket {
  title: string;
  yesPct: number;
}

interface Props {
  items: HeroMarket[];
}

/**
 * Hero altında yazı makinesi: gerçek market soruları tek tek yazılır,
 * yanına canlı EVET yüzdesi düşer, sonra silinip sıradakine geçer.
 */
export function HeroTicker({ items }: Props) {
  const [text, setText] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (items.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => { timeouts.push(setTimeout(r, ms)); });

    async function run() {
      while (!cancelled) {
        const item = items[idxRef.current % items.length];
        idxRef.current++;

        if (reduced) {
          setText(item.title); setPct(item.yesPct);
          await wait(3600);
          if (cancelled) return;
          continue;
        }

        // Yaz
        setPct(null);
        for (let i = 1; i <= item.title.length; i++) {
          if (cancelled) return;
          setText(item.title.slice(0, i));
          await wait(26);
        }
        setPct(item.yesPct);
        await wait(2600);

        // Sil (hızlı)
        for (let i = item.title.length; i >= 0; i -= 3) {
          if (cancelled) return;
          setText(item.title.slice(0, Math.max(i, 0)));
          await wait(11);
        }
        setPct(null);
      }
    }
    run();
    return () => { cancelled = true; timeouts.forEach(clearTimeout); };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 min-h-[32px] mb-8">
      <span className="font-data text-[15px] text-[var(--ink-2)]">
        {text}
        <span className="type-caret" />
      </span>
      {pct !== null && (
        <span className="ticker-item shrink-0 font-data text-[13px] font-medium bg-[var(--rise-soft)] text-[var(--rise)] border border-[var(--rise-line)] rounded-md px-2 py-0.5">
          EVET %{pct}
        </span>
      )}
    </div>
  );
}
