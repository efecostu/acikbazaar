import { createClient } from '@/lib/supabase/server';
import { LeaderboardClient } from './LeaderboardClient';

export const revalidate = 60;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(100);

  return <LeaderboardClient entries={entries ?? []} />;
}
