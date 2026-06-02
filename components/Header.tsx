'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/contexts/LangContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createClient } from '@/lib/supabase/client';
import { formatCredits } from '@/lib/utils';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  balance?: number;
  username?: string;
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Header({ balance, username }: HeaderProps) {
  const { lang, toggleLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const navLinks = [
    { href: '/markets', label: t('Marketler', 'Markets') },
    { href: '/portfolio', label: t('Portföy', 'Portfolio') },
    { href: '/leaderboard', label: t('Sıralama', 'Leaderboard') },
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] dark:border-[#334155] bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/markets" className="flex items-center gap-2 shrink-0">
          <span className="text-[#16A34A] font-bold text-lg leading-none">◈</span>
          <span className="text-sm font-bold text-[#111827] dark:text-[#F1F5F9] tracking-tight">AçıkBazaar</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors font-medium',
                pathname.startsWith(link.href)
                  ? 'text-[#16A34A] bg-[#F0FDF4] dark:bg-[#14532D]/40'
                  : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] hover:bg-[#F9FAFB] dark:hover:bg-[#1E293B]'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Balance */}
        {balance !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[#F0FDF4] dark:bg-[#14532D]/40 border border-[#BBF7D0] dark:border-[#166534] rounded-lg px-3 py-1.5">
            <span className="text-[#16A34A] text-xs font-bold">◈</span>
            <span className="text-sm font-semibold text-[#15803D] dark:text-[#4ADE80]">{formatCredits(balance)}</span>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Aydınlık mod' : 'Karanlık mod'}
          className="p-2 rounded-lg border border-[#E5E7EB] dark:border-[#334155] text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] hover:bg-[#F9FAFB] dark:hover:bg-[#1E293B] transition-colors"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Lang toggle */}
        <button
          onClick={toggleLang}
          className="text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] transition-colors px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#334155] hover:bg-[#F9FAFB] dark:hover:bg-[#1E293B]"
        >
          {lang === 'tr' ? 'EN' : 'TR'}
        </button>

        {/* Auth */}
        {username ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-sm font-medium text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9] transition-colors">
              @{username}
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              {t('Çıkış', 'Sign out')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">{t('Giriş', 'Log in')}</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">{t('Kayıt Ol', 'Sign up')}</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-[#F3F4F6] dark:border-[#1E293B] flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex-1 text-center py-2 text-xs font-medium transition-colors',
              pathname.startsWith(link.href)
                ? 'text-[#16A34A] border-b-2 border-[#16A34A]'
                : 'text-[#9CA3AF] dark:text-[#64748B]'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
