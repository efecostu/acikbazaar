import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LangProvider } from '@/contexts/LangContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

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
    <html lang="tr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Prevent dark mode flash on page load */}
        <script dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>
            {children}
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
