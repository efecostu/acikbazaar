import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, interests')
    .eq('id', user.id)
    .single();

  // İlgi alanları zaten seçilmişse tekrar sorma
  if (profile?.interests && profile.interests.length > 0) redirect('/markets');

  return <OnboardingClient username={profile?.username ?? ''} />;
}
