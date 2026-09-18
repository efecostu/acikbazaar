import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { runResolveSweep } from '@/lib/resolve';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // web search'lü çözümler uzun sürebilir

/**
 * Günlük çözüm cron'u (vercel.json). Yetki:
 *  - Vercel Cron: Authorization: Bearer <CRON_SECRET>  (CRON_SECRET env'i Vercel'de tanımlı olmalı)
 *  - Manuel: x-admin-secret: <ADMIN_SECRET>
 */
export async function GET() {
  const headerStore = await headers();
  const cronToken = headerStore.get('authorization')?.replace('Bearer ', '');
  const adminHeader = headerStore.get('x-admin-secret');

  const isVercelCron = !!process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;
  const isAdmin = !!process.env.ADMIN_SECRET && adminHeader === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdmin) {
    const hint = !process.env.CRON_SECRET ? 'CRON_SECRET env is not set on this deployment' : undefined;
    return Response.json({ error: 'Unauthorized', hint }, { status: 401 });
  }

  try {
    const admin = await createAdminClient();
    const result = await runResolveSweep(admin);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
