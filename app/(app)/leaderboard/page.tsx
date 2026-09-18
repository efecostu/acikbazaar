import { createClient } from '@/lib/supabase/server';
import { LeaderboardClient } from './LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: allTime }, { data: weekly }] = await Promise.all([
    supabase.from('leaderboard').select('*').limit(100),
    // leaderboard_weekly migration-8 ile gelir; yoksa boş liste
    supabase.from('leaderboard_weekly').select('*').limit(100),
  ]);

  return <LeaderboardClient entries={allTime ?? []} weekly={weekly ?? []} />;
}
