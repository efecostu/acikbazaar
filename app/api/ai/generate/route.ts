import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { generateMarkets, topUpMarkets } from '@/lib/generate';
import type { MarketCategory, MarketRegion } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Admin-only market üretimi.
 * Body: { region?, category?, count? }  → belirli kategori
 *       { topUp: true }                  → açık market sayısını hedefe tamamla
 */
export async function POST(req: Request) {
  const headerStore = await headers();
  if (!process.env.ADMIN_SECRET || headerStore.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const admin = await createAdminClient();

  try {
    if (body.topUp) {
      return Response.json(await topUpMarkets(admin));
    }
    const result = await generateMarkets(admin, {
      region: body.region as MarketRegion | undefined,
      category: body.category as MarketCategory | undefined,
      count: body.count,
    });
    if (result.inserted.length === 0) {
      return Response.json({ error: 'All generated markets failed validation', ...result }, { status: 422 });
    }
    return Response.json({ success: true, markets: result.inserted, rejected: result.rejected });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
