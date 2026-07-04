'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LangContext';

interface Props {
  endsAt: string;
}

/**
 * Bitişe 7 günden az kaldıysa canlı geri sayım gösterir (saniye tik'li).
 * Daha uzaksa hiçbir şey render etmez — tarih zaten görünüyor.
 */
export function Countdown({ endsAt }: Props) {
  const { t } = useLang();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => setLeft(new Date(endsAt).getTime() - Date.now());
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (left === null || left <= 0 || left > 7 * 864e5) return null;

  const d = Math.floor(left / 864e5);
  const h = Math.floor((left % 864e5) / 36e5);
  const m = Math.floor((left % 36e5) / 6e4);
  const sec = Math.floor((left % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="inline-flex items-center gap-1.5 font-data text-xs font-medium bg-[var(--fall-soft)] text-[var(--fall)] border border-[var(--fall-line)] rounded-md px-2 py-0.5">
      ⏳ {d > 0 ? `${d}${t('g', 'd')} ` : ''}{pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}
