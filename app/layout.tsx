import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LangProvider } from '@/contexts/LangContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AçıkBazaar — Açıkça tahmin et. Özgürce oyna.',
  description: 'Kalshi ve Polymarket\'ın tamamen ücretsiz simülasyon alternatifi. Gerçek para yok, gerçek hayat eventleri var.',
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
    <html lang="tr" className={inter.variable}>
      <body>
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
