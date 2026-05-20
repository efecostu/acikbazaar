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
    <header className="sticky top-0 z-50 border-b border-[#1E2130] bg-[#08090C]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/markets" className="flex items-center gap-2 shrink-0">
          <span className="text-[#00FF88] text-lg">◈</span>
          <span className="text-sm font-bold tracking-tight text-[#F0F2F5]">AçıkBazaar</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 text-xs rounded transition-colors',
                pathname.startsWith(link.href)
                  ? 'text-[#00FF88] bg-[#00FF88]/10'
                  : 'text-[#8892A4] hover:text-[#F0F2F5]'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Balance */}
        {balance !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[#0F1117] border border-[#1E2130] rounded px-3 py-1.5">
            <span className="text-[#00FF88] text-xs">◈</span>
            <span className="text-xs font-mono text-[#F0F2F5]">{formatCredits(balance)}</span>
          </div>
        )}

        {/* Lang toggle */}
        <button
          onClick={toggleLang}
          className="text-xs text-[#8892A4] hover:text-[#00FF88] transition-colors px-2 py-1 rounded border border-[#1E2130] hover:border-[#00FF88]"
        >
          {lang === 'tr' ? 'EN' : 'TR'}
        </button>

        {/* Profile / Auth */}
        {username ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-xs text-[#8892A4] hover:text-[#00FF88] transition-colors">
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
      <div className="md:hidden border-t border-[#1E2130] flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex-1 text-center py-2 text-xs transition-colors',
              pathname.startsWith(link.href)
                ? 'text-[#00FF88] border-b border-[#00FF88]'
                : 'text-[#8892A4]'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
