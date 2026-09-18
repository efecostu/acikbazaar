import { createAdminClient } from '@/lib/supabase/server';
import { ActivityClient, type ActivityRow } from './ActivityClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActivityPage() {
  const admin = await createAdminClient();

  const { data } = await admin
    .from('bets')
    .select('id, side, amount, odds_at_bet, potential_payout, status, created_at, profiles!inner(username, is_bot), markets!inner(id, title_tr, title_en, category, yes_prob)')
    .order('created_at', { ascending: false })
    .limit(150);

  type Raw = {
    id: string; side: 'yes' | 'no' | null; amount: number; odds_at_bet: number; potential_payout: number;
    status: string; created_at: string;
    profiles: { username: string; is_bot: boolean | null } | { username: string; is_bot: boolean | null }[];
    markets: { id: string; title_tr: string; title_en: string; category: string; yes_prob: number }
           | { id: string; title_tr: string; title_en: string; category: string; yes_prob: number }[];
  };

  const rows: ActivityRow[] = ((data ?? []) as unknown as Raw[]).map((b) => {
    const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const m = Array.isArray(b.markets) ? b.markets[0] : b.markets;
    return {
      id: b.id, side: b.side, amount: b.amount, odds: b.odds_at_bet, payout: b.potential_payout,
      status: b.status, created_at: b.created_at,
      username: p?.username ?? '—', is_bot: !!p?.is_bot,
      market_id: m?.id ?? '', title_tr: m?.title_tr ?? '', title_en: m?.title_en ?? '',
      category: m?.category ?? 'other', yes_prob: m?.yes_prob ?? 0.5,
    };
  });

  return <ActivityClient rows={rows} />;
}
