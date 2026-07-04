import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://acikbazaar.com';

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/markets`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/leaderboard`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${base}/register`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const supabase = await createAdminClient();
    const { data: markets } = await supabase
      .from('markets')
      .select('id, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500);

    const marketPages: MetadataRoute.Sitemap = (markets ?? []).map((m) => ({
      url: `${base}/markets/${m.id}`,
      lastModified: new Date(m.created_at),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    }));

    return [...staticPages, ...marketPages];
  } catch {
    return staticPages;
  }
}
