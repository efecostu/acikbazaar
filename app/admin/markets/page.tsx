import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatCredits, formatDate, categoryLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminMarketsPage() {
  const supabase = await createAdminClient();
  const { data: markets } = await supabase
    .from('markets')
    .select('*')
    .order('created_at', { ascending: false });

  const active   = markets?.filter(m => m.status === 'active').length   ?? 0;
  const resolved = markets?.filter(m => m.status === 'resolved').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Marketler</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {markets?.length ?? 0} toplam · {active} aktif · {resolved} kapandı
          </p>
        </div>
        <Link href="/admin/markets/new"
          className="bg-[#16A34A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#15803D] transition-colors">
          + Yeni Market
        </Link>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                <th className="px-5 py-3 text-left">Market</th>
                <th className="px-5 py-3 text-left">Kategori</th>
                <th className="px-5 py-3 text-left">Kapanış</th>
                <th className="px-5 py-3 text-right">EVET %</th>
                <th className="px-5 py-3 text-right">Hacim</th>
                <th className="px-5 py-3 text-right">Katılımcı</th>
                <th className="px-5 py-3 text-left">Durum</th>
                <th className="px-5 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {markets?.map((m) => {
                const overdue = m.status === 'active' && new Date(m.ends_at) < new Date();
                return (
                  <tr key={m.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-3 max-w-[260px]">
                      <div className="font-medium text-[#111827] truncate">{m.title_en}</div>
                      <div className="text-[11px] text-[#9CA3AF] truncate mt-0.5">{m.title_tr}</div>
                    </td>
                    <td className="px-5 py-3 text-[#6B7280] text-xs">{categoryLabel(m.category, 'en')}</td>
                    <td className={`px-5 py-3 text-xs font-medium ${overdue ? 'text-red-500' : 'text-[#6B7280]'}`}>
                      {formatDate(m.ends_at, 'tr')}
                      {overdue && <span className="block text-[10px]">⚠ Süresi dolmuş</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#16A34A]">
                      %{Math.round((m.yes_prob ?? 0) * 100)}
                    </td>
                    <td className="px-5 py-3 text-right text-[#6B7280] text-xs">
                      ◈{formatCredits(m.total_volume ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-[#6B7280] text-xs">
                      {m.participant_count ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${
                        m.status === 'active'
                          ? overdue ? 'bg-red-50 text-red-500' : 'bg-[#F0FDF4] text-[#16A34A]'
                          : 'bg-[#F3F4F6] text-[#9CA3AF]'
                      }`}>
                        {m.status === 'active'
                          ? overdue ? 'Süresi Doldu' : 'Aktif'
                          : `Kapandı — ${m.outcome ? 'EVET' : 'HAYIR'}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/markets/${m.id}`}
                        className="text-xs font-semibold text-[#16A34A] hover:underline">
                        Düzenle →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
