import type { Metadata } from 'next';
import './globals.css';
import { LangProvider } from '@/contexts/LangContext';

export const metadata: Metadata = {
  title: 'AçıkBazaar — Açıkça tahmin et. Özgürce oyna.',
  description: 'Kalshi ve Polymarket\'ın ücretsiz simülasyon alternatifi. Gerçek para yok, gerçek hayat eventleri var.',
  openGraph: {
    title: 'AçıkBazaar',
    description: 'Predict openly. Play freely.',
    url: 'https://acikbazaar.com',
    siteName: 'AçıkBazaar',
    locale: 'tr_TR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <LangProvider>
          <div id="app-root" className="relative z-10 min-h-screen">
            {children}
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
