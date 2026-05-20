import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  let query = supabase.from('markets').select('*').eq('status', 'active');

  const category = searchParams.get('category');
  const region = searchParams.get('region');

  if (category) query = query.eq('category', category);
  if (region) query = query.eq('region', region);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ markets: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { data, error } = await supabase.from('markets').insert(body).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ market: data });
}
