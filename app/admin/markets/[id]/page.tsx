import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { MarketAdminClient } from './MarketAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminMarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const [{ data: market }, { data: bets }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', id).single(),
    supabase.from('bets')
      .select('id, side, amount, odds_at_bet, potential_payout, status, created_at, profiles(username)')
      .eq('market_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!market) notFound();

  return <MarketAdminClient market={market} bets={(bets as any) ?? []} />;
}
