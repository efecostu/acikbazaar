import { createAdminClient } from '@/lib/supabase/server';
import { hasAdminSecret, isCronRequest, unauthorized } from '@/lib/adminAuth';
import { runResolveSweep } from '@/lib/resolve';
import { sendDailyReport } from '@/lib/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // web search'lü çözümler uzun sürebilir

/**
 * Günlük çözüm cron'u (vercel.json). Yetki:
 *  - Vercel Cron: Authorization: Bearer <CRON_SECRET>  (CRON_SECRET env'i Vercel'de tanımlı olmalı)
 *  - Manuel: x-admin-secret: <ADMIN_SECRET>
 */
export async function GET(req: Request) {
  const isVercelCron = await isCronRequest();
  const isAdmin = await hasAdminSecret();

  if (!isVercelCron && !isAdmin) {
    return unauthorized(!process.env.CRON_SECRET ? 'CRON_SECRET env is not set on this deployment' : undefined);
  }

  try {
    const admin = await createAdminClient();
    const result = await runResolveSweep(admin);
    // Cron bittikten hemen sonra "ne değişti" raporu (manuel çağrıda ?report=1 ile)
    const wantReport = isVercelCron || new URL(req.url).searchParams.get('report') === '1';
    let report: unknown = null;
    if (wantReport) {
      try { report = await sendDailyReport(admin, result); } catch (e) { report = { error: String(e) }; }
    }
    return Response.json({ ...result, report });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
