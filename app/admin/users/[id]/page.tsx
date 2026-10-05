import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminPage } from '@/lib/adminAuth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatCredits } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type BetRow = {
  id: string; side: string | null; amount: number; odds_at_bet: number; potential_payout: number; status: string;
  created_at: string; settled_at: string | null;
  markets: { id: string; title_tr: string; status: string } | null;
  market_options: { label_tr: string } | null;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'text-[#9CA3AF]' },
  won:     { label: 'Kazandı', cls: 'text-[#16A34A]' },
  lost:    { label: 'Kaybetti', cls: 'text-red-500' },
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createAdminClient();

  const [{ data: authRes }, { data: profile }, { data: betRows }, { data: comments }, { data: referrals }, { data: suggestions }] = await Promise.all([
    supabase.auth.admin.getUserById(id),
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('bets')
      .select('id, side, amount, odds_at_bet, potential_payout, status, created_at, settled_at, markets(id, title_tr, status), market_options(label_tr)')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(500),
    supabase.from('comments').select('id, content, created_at, markets(id, title_tr)').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id, username, created_at').eq('referred_by', id),
    supabase.from('market_suggestions').select('id, title_tr, status, created_at').eq('user_id', id).order('created_at', { ascending: false }),
  ]);

  const user = authRes?.user;
  if (!user && !profile) notFound();

  let referrer: string | null = null;
  if (profile?.referred_by) {
    const { data } = await supabase.from('profiles').select('username').eq('id', profile.referred_by).maybeSingle();
    referrer = data?.username ?? null;
  }
  let board: { profit: number; realized: number; unrealized: number; open_positions: number; win_rate: number | null } | null = null;
  if (profile?.username) {
    const { data } = await supabase.from('leaderboard').select('profit, realized, unrealized, open_positions, win_rate').eq('username', profile.username).maybeSingle();
    board = data;
  }

  const bets = (betRows ?? []) as unknown as BetRow[];
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  const pending = bets.filter((b) => b.status === 'pending');
  const won = bets.filter((b) => b.status === 'won');
  const lost = bets.filter((b) => b.status === 'lost');
  const isBot = !!profile?.is_bot;

  const info: [string, React.ReactNode][] = [
    ['E-posta', user?.email ?? '—'],
    ['Kullanıcı id', <code key="id" className="text-xs">{id}</code>],
    ['Kayıt', fmt(user?.created_at ?? profile?.created_at)],
    ['Son giriş', fmt(user?.last_sign_in_at)],
    ['E-posta onayı', user?.email_confirmed_at ? fmt(user.email_confirmed_at) : <span key="c" className="text-amber-600">onaylanmamış</span>],
    ['Giriş yöntemi', (user?.app_metadata?.providers as string[] | undefined)?.join(', ') ?? user?.app_metadata?.provider ?? '—'],
    ['Kayıtta girilen ad', String(user?.user_metadata?.username ?? '—')],
    ['Davet eden', referrer ? <Link key="r" href={`/admin/users/${profile!.referred_by}`} className="text-[#16A34A] hover:underline">{referrer}</Link> : '—'],
    ['Davet ettiği', `${referrals?.length ?? 0} kişi`],
    ['İlgi alanları', Array.isArray(profile?.interests) && profile.interests.length ? profile.interests.join(', ') : '—'],
    ['Seri', profile?.streak_count ? `${profile.streak_count} gün (son bahis ${profile.last_bet_date ?? '—'})` : '—'],
  ];

  const stats = [
    { label: 'Bakiye', value: `◈${formatCredits(profile?.balance ?? 0)}` },
    { label: 'Kâr (canlı)', value: board ? `${board.profit >= 0 ? '+' : '-'}◈${formatCredits(Math.abs(board.profit))}` : '—', color: board ? (board.profit >= 0 ? 'text-[#16A34A]' : 'text-red-500') : '' },
    { label: 'Toplam bahis', value: bets.length },
    { label: 'Yatırılan', value: `◈${formatCredits(staked)}` },
    { label: 'Kazandı / kaybetti', value: `${won.length} / ${lost.length}` },
    { label: 'Açık pozisyon', value: `${pending.length} · ◈${formatCredits(pending.reduce((s, b) => s + b.amount, 0))}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-xs text-[#6B7280] hover:text-[#111827]">← Kullanıcılar</Link>
        <h1 className="text-2xl font-bold text-[#111827] mt-1 flex items-center gap-2">
          {profile?.username ?? <span className="text-red-500">profil yok</span>}
          {isBot && <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">bot</span>}
        </h1>
        {!profile && <p className="text-sm text-red-500 mt-1">Auth hesabı var ama profili yok: bahis yapamaz. Kullanıcı giriş yapınca profil otomatik oluşturulur.</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={`text-lg font-bold ${color || 'text-[#111827]'}`}>{value}</div>
            <div className="text-xs text-[#9CA3AF] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6]">
        {info.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-5 py-2.5 text-sm">
            <div className="w-40 shrink-0 text-[#6B7280]">{k}</div>
            <div className="text-[#111827] min-w-0 break-all">{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Bahisler ({bets.length})</div>
        {bets.length === 0 ? <div className="px-5 py-4 text-sm text-[#9CA3AF]">Henüz bahis yok.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                  <th className="px-4 py-2 text-left">Tarih</th>
                  <th className="px-4 py-2 text-left">Market</th>
                  <th className="px-4 py-2 text-left">Seçim</th>
                  <th className="px-4 py-2 text-right">Tutar</th>
                  <th className="px-4 py-2 text-right">Oran</th>
                  <th className="px-4 py-2 text-right">Potansiyel</th>
                  <th className="px-4 py-2 text-left">Durum</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-4 py-2 text-xs text-[#6B7280] whitespace-nowrap">{fmt(b.created_at)}</td>
                    <td className="px-4 py-2 max-w-[340px] truncate">
                      {b.markets ? <Link href={`/admin/markets/${b.markets.id}`} className="hover:underline">{b.markets.title_tr}</Link> : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs font-semibold">{b.market_options?.label_tr ?? (b.side === 'yes' ? 'EVET' : b.side === 'no' ? 'HAYIR' : '—')}</td>
                    <td className="px-4 py-2 text-right">◈{formatCredits(b.amount)}</td>
                    <td className="px-4 py-2 text-right">{Number(b.odds_at_bet).toFixed(2)}x</td>
                    <td className="px-4 py-2 text-right">◈{formatCredits(b.potential_payout)}</td>
                    <td className={`px-4 py-2 text-xs font-medium ${STATUS[b.status]?.cls ?? ''}`}>{STATUS[b.status]?.label ?? b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Yorumlar ({comments?.length ?? 0})</div>
          {(comments ?? []).length === 0 && <div className="px-5 py-4 text-sm text-[#9CA3AF]">Yorum yok.</div>}
          {((comments ?? []) as unknown as { id: string; content: string; created_at: string; markets: { id: string; title_tr: string } | null }[]).map((c) => (
            <div key={c.id} className="px-5 py-3 border-b border-[#F3F4F6] last:border-0">
              <div className="text-xs text-[#9CA3AF]">{fmt(c.created_at)} · {c.markets?.title_tr}</div>
              <div className="text-sm text-[#111827] mt-0.5">{c.content}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Davet ettikleri ({referrals?.length ?? 0})</div>
            {(referrals ?? []).length === 0 && <div className="px-5 py-4 text-sm text-[#9CA3AF]">Yok.</div>}
            {(referrals ?? []).map((r) => (
              <Link key={r.id} href={`/admin/users/${r.id}`} className="flex justify-between px-5 py-2.5 border-b border-[#F3F4F6] last:border-0 text-sm hover:bg-[#F9FAFB]">
                <span>{r.username}</span><span className="text-xs text-[#9CA3AF]">{fmt(r.created_at)}</span>
              </Link>
            ))}
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Market önerileri ({suggestions?.length ?? 0})</div>
            {(suggestions ?? []).length === 0 && <div className="px-5 py-4 text-sm text-[#9CA3AF]">Yok.</div>}
            {(suggestions ?? []).map((s) => (
              <div key={s.id} className="flex justify-between gap-3 px-5 py-2.5 border-b border-[#F3F4F6] last:border-0 text-sm">
                <span className="truncate">{s.title_tr}</span><span className="text-xs text-[#9CA3AF] shrink-0">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
