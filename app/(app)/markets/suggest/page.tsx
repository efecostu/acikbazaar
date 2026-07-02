import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SuggestClient } from './SuggestClient';

export const dynamic = 'force-dynamic';

export default async function SuggestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: suggestions } = await supabase
    .from('market_suggestions')
    .select('id, title_tr, category, ends_at, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return <SuggestClient userId={user.id} mySuggestions={suggestions ?? []} />;
}
