import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Header } from '@/components/Header';

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
        <Header balance={1000} username="demo" />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    );
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, balance')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      <Header balance={profile?.balance} username={profile?.username} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
