import { createAdminClient } from '@/lib/supabase/server';
import { SuggestionsAdminClient } from './SuggestionsAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminSuggestionsPage() {
  const supabase = await createAdminClient();
  const { data: suggestions } = await supabase
    .from('market_suggestions')
    .select('id, title_tr, category, ends_at, details, status, created_at, profiles(username)')
    .order('created_at', { ascending: false })
    .limit(100);

  return <SuggestionsAdminClient suggestions={(suggestions as never[]) ?? []} />;
}
