import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { MarketDetailClient } from './MarketDetailClient';
import { Comments } from '@/components/Comments';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: market } = await supabase
    .from('markets')
    .select('title_tr, description_tr, yes_prob')
    .eq('id', id)
    .single();
  if (!market) return { title: 'AçıkBazaar' };
  const pct = Math.round((market.yes_prob ?? 0.5) * 100);
  return {
    title: `${market.title_tr} — AçıkBazaar`,
    description: market.description_tr ?? `Topluluk %${pct} EVET diyor. Sen ne dersin? Ücretsiz tahmin et.`,
  };
}

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: market }, { data: profile }, { data: userBets }, { data: comments }, { data: options }, { data: history }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', id).single(),
    user
      ? supabase.from('profiles').select('balance').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('bets').select('*, market_options(label_tr, label_en)').eq('market_id', id).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('comments')
      .select('id, content, created_at, profiles(username, is_bot)')
      .eq('market_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('market_options').select('*').eq('market_id', id).order('sort'),
    supabase
      .from('market_prob_history')
      .select('yes_prob, recorded_at')
      .eq('market_id', id)
      .order('recorded_at', { ascending: true })
      .limit(300),
  ]);

  if (!market) notFound();

  return (
    <>
      <MarketDetailClient
        market={market}
        balance={profile?.balance ?? 0}
        userId={user?.id ?? ''}
        userBets={(userBets as never[]) ?? []}
        options={options ?? []}
        history={history ?? []}
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
