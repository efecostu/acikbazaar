'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { GA_ID, CONSENT_KEY } from '@/lib/analytics';
import { useLang } from '@/contexts/LangContext';
import { Button } from '@/components/ui/Button';

/**
 * GA4 + çerez bandı. "Basic" rıza modu: kullanıcı kabul edene kadar gtag hiç yüklenmez,
 * reddederse hiç yüklenmez. Karar localStorage'da tutulur; /cerez-politikasi'ndan değiştirilebilir.
 */
export default function Analytics() {
  const { t } = useLang();
  const [consent, setConsent] = useState<'granted' | 'denied' | null | undefined>(undefined);

  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(CONSENT_KEY); } catch {}
    setConsent(v === 'granted' || v === 'denied' ? v : null);
    const onChange = () => {
      try { setConsent((localStorage.getItem(CONSENT_KEY) as 'granted' | 'denied' | null) ?? null); } catch {}
    };
    window.addEventListener('ab-consent', onChange);
    return () => window.removeEventListener('ab-consent', onChange);
  }, []);

  if (!GA_ID) return null;

  function decide(v: 'granted' | 'denied') {
    try { localStorage.setItem(CONSENT_KEY, v); } catch {}
    setConsent(v);
  }

  return (
    <>
      {consent === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {consent === null && (
        <div
          role="dialog"
          aria-label={t('Çerez tercihi', 'Cookie preference')}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-xl sm:border"
        >
          <p className="text-sm text-[var(--ink-2)]">
            {t(
              'Siteyi nasıl kullandığını anlamak için analitik çerezler (Google Analytics) kullanmak istiyoruz. Reddedersen site aynen çalışır.',
              'We would like to use analytics cookies (Google Analytics) to understand how the site is used. The site works the same if you decline.',
            )}{' '}
            <Link href="/cerez-politikasi" className="underline">{t('Ayrıntılar', 'Details')}</Link>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => decide('granted')}>{t('Kabul et', 'Accept')}</Button>
            <Button size="sm" variant="outline" onClick={() => decide('denied')}>{t('Reddet', 'Decline')}</Button>
          </div>
        </div>
      )}
    </>
  );
}
