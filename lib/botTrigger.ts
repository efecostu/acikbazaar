import { after } from 'next/server';

/**
 * Sayfa yanıtı gönderildikten sonra bot tick'ini dürter (trafik bazlı canlılık).
 * Endpoint kendi içinde 12 dk throttle'lı ve gece saatlerinde uyur; her ziyaret bahis üretmez.
 * Hobby planda 3. cron olmadığı için canlılık bu şekilde + harici ping ile sağlanır (README).
 */
export function nudgeBots() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret || !base.startsWith('http')) return;
  after(async () => {
    try {
      await fetch(`${base}/api/bots/tick`, { headers: { 'x-admin-secret': secret }, cache: 'no-store' });
    } catch { /* bot aktivitesi kritik değil */ }
  });
}
