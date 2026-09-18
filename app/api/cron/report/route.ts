import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { sendDailyReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

/** Manuel rapor (cron'dan bağımsız, sadece DB'ye bakar). Asıl rapor resolve cron'unun sonunda gönderilir. */
export async function GET() {
  const headerStore = await headers();
  const cronToken = headerStore.get('authorization')?.replace('Bearer ', '');
  const isVercelCron = !!process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;
  const isAdmin = !!process.env.ADMIN_SECRET && headerStore.get('x-admin-secret') === process.env.ADMIN_SECRET;
  if (!isVercelCron && !isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = await createAdminClient();
    return Response.json(await sendDailyReport(admin));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
