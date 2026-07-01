export const dynamic = 'force-dynamic';
import { Header } from '@/components/Header';

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F9FAFB] dark:bg-[#0F172A]">
        <Header balance={1000} username="demo" />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      </div>
    );
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Marketler public — giriş yapmamış kullanıcı gezinebilir, bahis için login gerekir
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F9FAFB] dark:bg-[#0F172A]">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      </div>
    );
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('username, balance')
    .eq('id', user.id)
    .single();

  // Profile yoksa service role ile oluştur (trigger çalışmamış olabilir)
  if (!profile) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = await createAdminClient();
    const username = user.user_metadata?.username
      || user.email?.split('@')[0]
      || 'user';

    await admin.from('profiles').upsert({
      id: user.id,
      username,
      balance: 1000,
      total_bets: 0,
      total_won: 0,
    }, { onConflict: 'id', ignoreDuplicates: true });

    profile = { username, balance: 1000 };
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] dark:bg-[#0F172A]">
      <Header balance={profile.balance} username={profile.username} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
