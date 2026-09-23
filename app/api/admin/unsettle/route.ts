import { hasAdminSecret, unauthorized } from '@/lib/adminAuth';
import { createAdminClient } from '@/lib/supabase/server';
import { unsettleMarket } from '@/lib/settle';

export const dynamic = 'force-dynamic';

/** POST { market_id } — yanlış çözümü geri al. x-admin-secret gerekir. */
export async function POST(req: Request) {
  if (!(await hasAdminSecret())) return unauthorized();
  const { market_id } = await req.json().catch(() => ({}));
  if (!market_id) return Response.json({ error: 'market_id required' }, { status: 400 });
  const admin = await createAdminClient();
  const r = await unsettleMarket(admin, market_id);
  return Response.json({ ok: true, ...r });
}
