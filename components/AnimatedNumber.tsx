'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Sayıyı stringe çevirir (örn. formatCredits). Varsayılan: yuvarla */
  format?: (v: number) => string;
  duration?: number;
  className?: string;
  /** Değişimde kısa parlama efekti */
  flash?: boolean;
}

/**
 * Değer değişince eski değerden yenisine akarak sayan rakam.
 * Tabela hissi: değişim anında kısa bir parlama yapabilir.
 */
export function AnimatedNumber({ value, format = (v) => String(Math.round(v)), duration = 600, className = '', flash = true }: Props) {
  const [display, setDisplay] = useState(value);
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDisplay(to); return; }

    if (flash) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 500);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration, flash]);

  return (
    <span className={`${className} ${flashing ? 'num-flash' : ''}`}>
      {format(display)}
    </span>
  );
}
