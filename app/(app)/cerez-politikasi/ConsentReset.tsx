'use client';

import { useEffect, useState } from 'react';
import { CONSENT_KEY } from '@/lib/analytics';
import { Button } from '@/components/ui/Button';

export default function ConsentReset() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    try { setCurrent(localStorage.getItem(CONSENT_KEY)); } catch {}
  }, []);

  function reset() {
    try { localStorage.removeItem(CONSENT_KEY); } catch {}
    setCurrent(null);
    window.dispatchEvent(new Event('ab-consent'));
    // gtag yüklendiyse sayfadan atmak için yenile
    if (current === 'granted') window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">
        Şu anki tercih: <b>{current === 'granted' ? 'kabul edildi' : current === 'denied' ? 'reddedildi' : 'seçilmedi'}</b>
      </span>
      <Button size="sm" variant="outline" onClick={reset}>Tercihi sıfırla</Button>
    </div>
  );
}
