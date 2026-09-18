import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Public: açık marketler (opsiyonel category/region filtresi). Market oluşturma sadece admin panelinden. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  let query = supabase
    .from('markets')
    .select('*, market_options(*)')
    .eq('status', 'active')
    .gt('ends_at', new Date().toISOString());

  const category = searchParams.get('category');
  const region = searchParams.get('region');
  if (category) query = query.eq('category', category);
  if (region) query = query.eq('region', region);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ markets: data }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
}
