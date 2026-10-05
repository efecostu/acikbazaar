import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminPage } from '@/lib/adminAuth';
import Link from 'next/link';
import { formatCredits } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  email: string | null;
  username: string | null;
  isBot: boolean;
  hasProfile: boolean;
  confirmed: boolean;
  createdAt: string;
  lastSignIn: string | null;
  balance: number;
  totalBets: number;
  totalWon: number;
  profit: number | null;
  streak: number;
  referralCount: number;
  referredBy: string | null;
};

const SORTS: Record<string, { label: string; fn: (a: Row, b: Row) => number }> = {
  created: { label: 'Kayıt (yeni)', fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  login:   { label: 'Son giriş', fn: (a, b) => (b.lastSignIn ?? '').localeCompare(a.lastSignIn ?? '') },
  balance: { label: 'Bakiye', fn: (a, b) => b.balance - a.balance },
  bets:    { label: 'Bahis sayısı', fn: (a, b) => b.totalBets - a.totalBets },
  profit:  { label: 'Kâr', fn: (a, b) => (b.profit ?? 0) - (a.profit ?? 0) },
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; sort?: string }> }) {
  await requireAdminPage();
  const { q = '', type = 'human', sort = 'created' } = await searchParams;
  const supabase = await createAdminClient();

  const [{ data: authData, error: authError }, { data: profiles }, { data: board }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('profiles').select('id, username, balance, total_bets, total_won, created_at, is_bot, streak_count, referred_by, referral_count'),
    supabase.from('leaderboard').select('username, profit'),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const profitByName = new Map((board ?? []).map((b) => [b.username, Number(b.profit)]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const rows: Row[] = (authData?.users ?? []).map((u) => {
    const p = profileById.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      username: p?.username ?? null,
      isBot: !!p?.is_bot || (u.email ?? '').endsWith('@bots.acikbazaar.com'),
      hasProfile: !!p,
      confirmed: !!u.email_confirmed_at,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      balance: p?.balance ?? 0,
      totalBets: p?.total_bets ?? 0,
      totalWon: p?.total_won ?? 0,
      profit: p ? profitByName.get(p.username) ?? null : null,
      streak: p?.streak_count ?? 0,
      referralCount: p?.referral_count ?? 0,
      referredBy: p?.referred_by ? nameById.get(p.referred_by) ?? null : null,
    };
  });

  const humans = rows.filter((r) => !r.isBot);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const stats = [
    { label: 'Toplam hesap', value: rows.length },
    { label: 'Gerçek kullanıcı', value: humans.length },
    { label: 'Bot', value: rows.length - humans.length },
    { label: 'Son 7 gün kayıt', value: humans.filter((r) => r.createdAt >= weekAgo).length },
    { label: 'Bahis yapan', value: humans.filter((r) => r.totalBets > 0).length },
    { label: 'Profili yok', value: rows.filter((r) => !r.hasProfile).length, warn: true },
  ];

  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => type === 'all' || (type === 'bot' ? r.isBot : !r.isBot))
    .filter((r) => !needle || [r.username, r.email, r.id].some((v) => v?.toLowerCase().includes(needle)))
    .sort((SORTS[sort] ?? SORTS.created).fn);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Kullanıcılar</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Tüm hesaplar (auth + profil). Satıra tıkla → detay.</p>
      </div>

      {authError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">Auth kullanıcıları okunamadı: {authError.message}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, warn }) => (
          <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={`text-xl font-bold ${warn && value > 0 ? 'text-red-500' : 'text-[#111827]'}`}>{value}</div>
            <div className="text-xs text-[#9CA3AF] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap gap-2 items-center">
        <input name="q" defaultValue={q} placeholder="Kullanıcı adı, e-posta veya id ara"
          className="flex-1 min-w-[220px] px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white" />
        <select name="type" defaultValue={type} className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white">
          <option value="human">Gerçek kullanıcılar</option>
          <option value="bot">Botlar</option>
          <option value="all">Hepsi</option>
        </select>
        <select name="sort" defaultValue={sort} className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white">
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <button className="px-4 py-2 text-sm font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D]">Uygula</button>
        <span className="text-xs text-[#9CA3AF]">{shown.length} sonuç</span>
      </form>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                <th className="px-4 py-3 text-left">Kullanıcı</th>
                <th className="px-4 py-3 text-left">Kayıt</th>
                <th className="px-4 py-3 text-left">Son giriş</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3 text-right">Bahis</th>
                <th className="px-4 py-3 text-right">Kazanç</th>
                <th className="px-4 py-3 text-right">Kâr</th>
                <th className="px-4 py-3 text-right">Seri</th>
                <th className="px-4 py-3 text-left">Davet</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${r.id}`} className="block">
                      <div className="font-semibold text-[#111827] flex items-center gap-1.5">
                        {r.username ?? <span className="text-red-500">profil yok</span>}
                        {r.isBot && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">bot</span>}
                        {!r.confirmed && !r.isBot && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">onaysız</span>}
                      </div>
                      <div className="text-xs text-[#6B7280]">{r.email ?? '—'}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#374151] whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-[#374151] whitespace-nowrap">{fmt(r.lastSignIn)}</td>
                  <td className="px-4 py-3 text-right font-medium">◈{formatCredits(r.balance)}</td>
                  <td className="px-4 py-3 text-right">{r.totalBets}</td>
                  <td className="px-4 py-3 text-right">◈{formatCredits(r.totalWon)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.profit === null ? 'text-[#9CA3AF]' : r.profit >= 0 ? 'text-[#16A34A]' : 'text-red-500'}`}>
                    {r.profit === null ? '—' : `${r.profit >= 0 ? '+' : ''}◈${formatCredits(Math.abs(r.profit))}`}
                  </td>
                  <td className="px-4 py-3 text-right">{r.streak || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#374151]">
                    {r.referredBy && <div>← {r.referredBy}</div>}
                    {r.referralCount > 0 && <div>{r.referralCount} davet</div>}
                    {!r.referredBy && !r.referralCount && '—'}
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
