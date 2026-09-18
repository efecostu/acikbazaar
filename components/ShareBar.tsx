'use client';

import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';

interface Props {
  path: string;      // "/markets/<id>" veya "/register?ref=..."
  text: string;      // paylaşım metni
  compact?: boolean;
}

/** X / WhatsApp / Telegram / kopyala — tek satır paylaşım şeridi. */
export function ShareBar({ path, text, compact = false }: Props) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://acikbazaar.com';
  const url = `${base}${path}`;
  const enc = encodeURIComponent;

  const links = [
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard kapalıysa sessiz */ }
  }

  const btn = 'font-data text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--rise)] hover:text-[var(--rise)] transition-colors';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!compact && <span className="text-[11px] uppercase tracking-wider text-[var(--ink-3)] mr-1">{t('Paylaş', 'Share')}</span>}
      {links.map((l) => (
        <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className={btn}>{l.name}</a>
      ))}
      <button onClick={copy} className={btn}>
        {copied ? t('Kopyalandı ✓', 'Copied ✓') : t('Linki kopyala', 'Copy link')}
      </button>
    </div>
  );
}
