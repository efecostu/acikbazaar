import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'efecostu01@gmail.com';

const NAV = [
  { href: '/admin',              label: 'Dashboard',    icon: '📊' },
  { href: '/admin/markets',      label: 'Marketler',    icon: '📋' },
  { href: '/admin/markets/new',  label: 'Yeni Market',  icon: '➕' },
  { href: '/admin/suggestions',  label: 'Öneriler',     icon: '💡' },
  { href: '/admin/bets',         label: 'Bahisler',     icon: '🎯' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) redirect('/markets');

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-[#E5E7EB] flex flex-col h-screen sticky top-0 shrink-0">
        <div className="px-4 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="text-[#16A34A] font-black text-lg">◈</span>
            <div>
              <div className="text-sm font-bold text-[#111827]">AçıkBazaar</div>
              <div className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors">
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-[#E5E7EB]">
          <Link href="/markets"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
            ← Siteye dön
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
