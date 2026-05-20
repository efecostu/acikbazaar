'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Lang } from '@/types';

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (tr: string, en: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'tr',
  toggleLang: () => {},
  t: (tr) => tr,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('tr');

  const toggleLang = () => setLang((l) => (l === 'tr' ? 'en' : 'tr'));
  const t = (tr: string, en: string) => (lang === 'tr' ? tr : en);

  return (
    <LangContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
