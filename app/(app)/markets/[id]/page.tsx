import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketDetailClient } from './MarketDetailClient';
import { Comments } from '@/components/Comments';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: market }, { data: profile }, { data: userBets }, { data: comments }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', id).single(),
    user
      ? supabase.from('profiles').select('balance').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('bets').select('*').eq('market_id', id).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('comments')
      .select('id, content, created_at, profiles(username, is_bot)')
      .eq('market_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (!market) notFound();

  return (
    <>
      <MarketDetailClient
        market={market}
        balance={profile?.balance ?? 0}
        userId={user?.id ?? ''}
        userBets={userBets ?? []}
      />
      <div className="max-w-2xl mx-auto mt-5">
        <Comments
          marketId={id}
          userId={user?.id ?? ''}
          initialComments={(comments as never[]) ?? []}
        />
      </div>
    </>
  );
}
