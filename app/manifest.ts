import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AçıkBazaar — Tahmin Pazarı',
    short_name: 'AçıkBazaar',
    description: 'Türkiye\'nin ücretsiz tahmin pazarı. Gerçek para yok, gerçek hayat eventleri var.',
    start_url: '/markets',
    display: 'standalone',
    background_color: '#0C1F16',
    theme_color: '#0C1F16',
    lang: 'tr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
