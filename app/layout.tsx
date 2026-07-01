import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { LangProvider } from '@/contexts/LangContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
});
const body = Figtree({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'AçıkBazaar — Olacak mı, olmayacak mı?',
  description: 'Türkiye\'nin ücretsiz tahmin pazarı. Gerçek para yok, gerçek hayat eventleri var. Sanal kredinle tahmin et, toplulukla yarış.',
  openGraph: {
    title: 'AçıkBazaar',
    description: 'Olacak mı, olmayacak mı? Türkiye\'nin ücretsiz tahmin pazarı.',
    url: 'https://acikbazaar.com',
    siteName: 'AçıkBazaar',
    locale: 'tr_TR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
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
