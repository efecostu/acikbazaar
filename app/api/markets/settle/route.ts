import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function POST(req: Request) {
  const headerStore = await headers();
  const adminSecret = headerStore.get('x-admin-secret');

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { marketId, outcome } = await req.json();
  const supabase = await createAdminClient();
  const winningSide = outcome ? 'yes' : 'no';

  await supabase
    .from('markets')
    .update({ status: 'resolved', outcome })
    .eq('id', marketId);

  const { data: winningBets } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', marketId)
    .eq('side', winningSide)
    .eq('status', 'pending');

  for (const bet of winningBets ?? []) {
    await supabase.rpc('credit_and_update_user', {
      p_user_id: bet.user_id,
      p_amount: bet.potential_payout,
    });
    await supabase
      .from('bets')
      .update({ status: 'won', settled_at: new Date().toISOString() })
      .eq('id', bet.id);
  }

  await supabase
    .from('bets')
    .update({ status: 'lost', settled_at: new Date().toISOString() })
    .eq('market_id', marketId)
    .neq('side', winningSide)
    .eq('status', 'pending');

  return Response.json({ success: true, winnersCount: winningBets?.length ?? 0 });
}
