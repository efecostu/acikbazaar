import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketDetailClient } from './MarketDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: market }, { data: profile }, { data: userBets }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', id).single(),
    supabase.from('profiles').select('balance').eq('id', user.id).single(),
    supabase.from('bets').select('*').eq('market_id', id).eq('user_id', user.id),
  ]);

  if (!market) notFound();

  return (
    <MarketDetailClient
      market={market}
      balance={profile?.balance ?? 0}
      userId={user.id}
      userBets={userBets ?? []}
    />
  );
}
