import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://acikbazaar.com').replace(/\/+$/, '');

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/markets`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/leaderboard`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${base}/activity`, changeFrequency: 'hourly', priority: 0.4 },
    { url: `${base}/register`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const supabase = await createAdminClient();
    const { data: markets } = await supabase
      .from('markets')
      .select('id, status, created_at, resolved_at')
      .in('status', ['active', 'closed', 'resolved'])
      .order('created_at', { ascending: false })
      .limit(500);

    const marketPages: MetadataRoute.Sitemap = (markets ?? []).map((m) => ({
      url: `${base}/markets/${m.id}`,
      lastModified: new Date(m.resolved_at ?? m.created_at),
      changeFrequency: m.status === 'resolved' ? 'monthly' as const : 'hourly' as const,
      priority: m.status === 'resolved' ? 0.5 : 0.8,
    }));

    return [...staticPages, ...marketPages];
  } catch {
    return staticPages;
  }
}
