import { createClient } from '@/lib/supabase/server';
import { PortfolioClient } from './PortfolioClient';
import { redirect } from 'next/navigation';

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: bets } = await supabase
    .from('bets')
    .select('*, market:markets(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <PortfolioClient bets={bets ?? []} />;
}
