import { createAdminClient } from '@/lib/supabase/server';
import { hasAdminSecret, isCronRequest, unauthorized } from '@/lib/adminAuth';
import { sendDailyReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

/** Manuel rapor (cron'dan bağımsız, sadece DB'ye bakar). Asıl rapor resolve cron'unun sonunda gönderilir. */
export async function GET() {
  if (!(await isCronRequest()) && !(await hasAdminSecret())) return unauthorized();

  try {
    const admin = await createAdminClient();
    return Response.json(await sendDailyReport(admin));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
