import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { settleMarket } from '@/lib/settle';
import { sendWinEmails } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Manuel çözüm API'si — admin secret ile. Body: { marketId, outcome } veya { marketId, winningOptionId } */
export async function POST(req: Request) {
  const headerStore = await headers();
  if (!process.env.ADMIN_SECRET || headerStore.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { marketId, outcome, winningOptionId, reasoning } = body as {
    marketId?: string; outcome?: boolean; winningOptionId?: string; reasoning?: string;
  };
  if (!marketId) return Response.json({ error: 'marketId required' }, { status: 400 });

  try {
    const admin = await createAdminClient();
    const result = await settleMarket(admin, marketId, {
      outcome: typeof outcome === 'boolean' ? outcome : null,
      winningOptionId: winningOptionId ?? null,
      reasoning: reasoning ?? null,
    });
    await sendWinEmails(admin, result.wins);
    return Response.json({ success: true, winners: result.winners, losers: result.losers });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }
}
