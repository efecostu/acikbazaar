'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[AçıkBazaar] page error', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="font-data text-[11px] tracking-[0.18em] uppercase text-[var(--fall)] mb-4">hata</div>
        <h1 className="font-display text-3xl font-bold text-[var(--ink)] mb-3">Bir şeyler ters gitti.</h1>
        <p className="text-sm text-[var(--ink-2)] mb-8">
          Sayfa yüklenirken beklenmedik bir hata oluştu. Tekrar denemek genelde işe yarar.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="bg-[var(--rise)] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:brightness-110 transition-all">
            Tekrar dene
          </button>
          <Link href="/markets" className="border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
            Marketlere git
          </Link>
        </div>
        {error.digest && <p className="font-data text-[10px] text-[var(--ink-3)] mt-6">ref: {error.digest}</p>}
      </div>
    </div>
  );
}
