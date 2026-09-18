import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="font-data text-[11px] tracking-[0.18em] uppercase text-[var(--rise)] mb-4">404</div>
        <h1 className="font-display text-3xl font-bold text-[var(--ink)] mb-3">Bu sayfa yok — ya da hiç olmadı.</h1>
        <p className="text-sm text-[var(--ink-2)] mb-8">
          Aradığın market kapanmış, silinmiş ya da adres yanlış yazılmış olabilir.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/markets" className="bg-[var(--rise)] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:brightness-110 transition-all">
            Marketlere git
          </Link>
          <Link href="/" className="border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
