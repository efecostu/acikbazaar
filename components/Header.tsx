'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { formatCredits } from '@/lib/utils';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  balance?: number;
  username?: string;
}

export function Header({ balance, username }: HeaderProps) {
  const { lang, toggleLang, t } = useLang();
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
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/markets" className="flex items-center gap-2 shrink-0">
          <span className="text-[#16A34A] font-bold text-lg leading-none">◈</span>
          <span className="text-sm font-bold text-[#111827] tracking-tight">AçıkBazaar</span>
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
                  ? 'text-[#16A34A] bg-[#F0FDF4]'
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Balance */}
        {balance !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-1.5">
            <span className="text-[#16A34A] text-xs font-bold">◈</span>
            <span className="text-sm font-semibold text-[#15803D]">{formatCredits(balance)}</span>
          </div>
        )}

        {/* Lang toggle */}
        <button
          onClick={toggleLang}
          className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] transition-colors px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]"
        >
          {lang === 'tr' ? 'EN' : 'TR'}
        </button>

        {/* Auth */}
        {username ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
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
      <div className="md:hidden border-t border-[#F3F4F6] flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex-1 text-center py-2 text-xs font-medium transition-colors',
              pathname.startsWith(link.href)
                ? 'text-[#16A34A] border-b-2 border-[#16A34A]'
                : 'text-[#9CA3AF]'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
