/**
 * GA4 yardımcıları. Etiket yalnızca NEXT_PUBLIC_GA_ID tanımlıysa ve kullanıcı çerez bandında
 * "Kabul et" dediyse yüklenir (KVKK: analitik çerez için açık rıza). Rıza yoksa track() sessizce no-op.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
export const CONSENT_KEY = 'ab_consent'; // 'granted' | 'denied'

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { gtag?: Gtag; dataLayer?: unknown[] }
}

export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  try {
    window.gtag?.('event', event, params);
  } catch {
    // analitik hiçbir zaman kullanıcı akışını bozmamalı
  }
}
