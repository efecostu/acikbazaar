import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatCredits } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminBetsPage() {
  const supabase = await createAdminClient();
  const { data: bets } = await supabase
    .from('bets')
    .select('id, side, amount, odds_at_bet, potential_payout, status, created_at, profiles(username), markets(id, title_en)')
    .order('created_at', { ascending: false })
    .limit(200);

  const total   = bets?.length ?? 0;
  const volume  = bets?.reduce((s, b) => s + (b.amount ?? 0), 0) ?? 0;
  const won     = bets?.filter(b => b.status === 'won').length  ?? 0;
  const pending = bets?.filter(b => b.status === 'pending').length ?? 0;
  const lost    = bets?.filter(b => b.status === 'lost').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Bahisler</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Son 200 bahis</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Toplam',        value: total,                         color: '' },
          { label: 'Bekliyor',      value: pending,                       color: 'text-[#9CA3AF]' },
          { label: 'Kazanan',       value: won,                           color: 'text-[#16A34A]' },
          { label: 'Kaybeden',      value: lost,                          color: 'text-red-500' },
          { label: 'Toplam Hacim',  value: `◈${formatCredits(volume)}`,   color: '' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={`text-xl font-bold ${color || 'text-[#111827]'}`}>{value}</div>
            <div className="text-xs text-[#9CA3AF] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                <th className="px-5 py-3 text-left">Kullanıcı</th>
                <th className="px-5 py-3 text-left">Market</th>
                <th className="px-5 py-3 text-left">Taraf</th>
                <th className="px-5 py-3 text-right">Miktar</th>
                <th className="px-5 py-3 text-right">Oran</th>
                <th className="px-5 py-3 text-right">Potansiyel</th>
                <th className="px-5 py-3 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {(bets as any[])?.map((bet) => (
                <tr key={bet.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-5 py-3 font-medium text-[#111827]">
                    {bet.profiles?.username ?? '—'}
                  </td>
                  <td className="px-5 py-3 max-w-[240px]">
                    <Link href={`/admin/markets/${bet.markets?.id}`}
                      className="text-[#6B7280] hover:text-[#16A34A] truncate block transition-colors">
                      {bet.markets?.title_en ?? '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-bold text-xs ${bet.side !== 'no' ? 'text-[#16A34A]' : 'text-red-500'}`}>
                      {bet.side ? bet.side.toUpperCase() : 'SEÇENEK'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">◈{formatCredits(bet.amount)}</td>
                  <td className="px-5 py-3 text-right text-[#6B7280]">{bet.odds_at_bet}x</td>
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
