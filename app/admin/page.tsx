import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatCredits, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createAdminClient();

  const [
    { count: totalUsers },
    { count: totalBets },
    { data: markets },
    { data: recentBets },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('bets').select('*', { count: 'exact', head: true }),
    supabase.from('markets').select('id, title_en, total_volume, status, ends_at, participant_count, outcome'),
    supabase.from('bets')
      .select('id, side, amount, potential_payout, status, odds_at_bet, profiles(username), markets(id, title_en)')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const totalVolume = markets?.reduce((s, m) => s + (m.total_volume ?? 0), 0) ?? 0;
  const activeMarkets = markets?.filter(m => m.status === 'active') ?? [];
  const resolvedMarkets = markets?.filter(m => m.status === 'resolved') ?? [];

  const expiringSoon = activeMarkets.filter((m) => {
    const days = (new Date(m.ends_at).getTime() - Date.now()) / 864e5;
    return days <= 7 && days >= 0;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Platform genel özeti</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktif Market',     value: activeMarkets.length,           icon: '📋', color: '#16A34A' },
          { label: 'Toplam Kullanıcı', value: totalUsers ?? 0,                icon: '👥', color: '#3B82F6' },
          { label: 'Toplam Bahis',     value: totalBets ?? 0,                 icon: '🎯', color: '#8B5CF6' },
          { label: 'İşlem Hacmi',      value: `◈${formatCredits(totalVolume)}`, icon: '💰', color: '#F59E0B' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-2xl mb-3">{icon}</div>
            <div className="text-2xl font-bold text-[#111827]">{value}</div>
            <div className="text-xs text-[#9CA3AF] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Expiring soon warning */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-bold text-amber-700 mb-2">
            ⚠️ 7 Gün İçinde Kapanacak ({expiringSoon.length} market)
          </div>
          <div className="flex flex-col gap-1.5">
            {expiringSoon.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <Link href={`/admin/markets/${m.id}`} className="text-amber-700 hover:underline truncate max-w-sm">
                  {m.title_en}
                </Link>
                <span className="text-amber-500 shrink-0 ml-4">{formatDate(m.ends_at, 'tr')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market + Bets summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Market Dağılımı</div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Aktif',    value: activeMarkets.length,   color: 'bg-[#16A34A]' },
              { label: 'Kapandı', value: resolvedMarkets.length,  color: 'bg-[#9CA3AF]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[#374151]">{label}</span>
                </div>
                <span className="font-bold text-[#111827]">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Hızlı Erişim</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/admin/markets/new', label: '+ Yeni Market',     cls: 'bg-[#16A34A] text-white hover:bg-[#15803D]' },
              { href: '/admin/markets',     label: '→ Tüm Marketler',   cls: 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]' },
              { href: '/admin/bets',        label: '→ Tüm Bahisler',    cls: 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]' },
              { href: '/markets',           label: '→ Siteye Git',      cls: 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]' },
            ].map(({ href, label, cls }) => (
              <Link key={href} href={href}
                className={`text-center text-sm font-semibold px-4 py-3 rounded-lg transition-colors ${cls}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bets */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111827]">Son Bahisler</h2>
          <Link href="/admin/bets" className="text-xs text-[#16A34A] font-medium hover:underline">Tümü →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Kullanıcı</th>
                <th className="px-5 py-3 text-left">Market</th>
                <th className="px-5 py-3 text-left">Taraf</th>
                <th className="px-5 py-3 text-right">Miktar</th>
                <th className="px-5 py-3 text-right">Potansiyel</th>
                <th className="px-5 py-3 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {(recentBets as any[])?.map((bet) => (
                <tr key={bet.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-5 py-3 font-medium text-[#111827]">{bet.profiles?.username ?? '—'}</td>
                  <td className="px-5 py-3 max-w-[220px]">
                    <Link href={`/admin/markets/${bet.markets?.id}`}
                      className="text-[#6B7280] hover:text-[#16A34A] truncate block transition-colors">
                      {bet.markets?.title_en ?? '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-bold text-xs ${bet.side === 'yes' ? 'text-[#16A34A]' : 'text-red-500'}`}>
                      {bet.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">◈{formatCredits(bet.amount)}</td>
                  <td className="px-5 py-3 text-right text-[#6B7280]">◈{formatCredits(bet.potential_payout)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      bet.status === 'won'  ? 'bg-[#F0FDF4] text-[#16A34A]' :
                      bet.status === 'lost' ? 'bg-red-50 text-red-500' :
                                              'bg-[#F3F4F6] text-[#9CA3AF]'
                    }`}>
                      {bet.status === 'won' ? 'KAZANDI' : bet.status === 'lost' ? 'KAYBETTİ' : 'Bekliyor'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
