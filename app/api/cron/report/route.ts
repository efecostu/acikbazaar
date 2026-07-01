import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const REPORT_EMAILS = ['efecostu01@gmail.com', 'eminaliozturk@gmail.com'];

export async function GET() {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  const adminHeader = headerStore.get('x-admin-secret');
  const cronToken = authHeader?.replace('Bearer ', '');

  const isVercelCron = !!process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;
  const isAdmin = adminHeader === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

  // Paralel veri çekme
  const [
    { data: resolvedToday },
    { data: newMarkets },
    { data: bets24h },
    { data: newUsers },
    { data: topWinners },
    { data: platformStats },
  ] = await Promise.all([
    supabase.from('markets').select('title_en, outcome, ends_at').eq('status', 'resolved').gte('resolved_at', since),
    supabase.from('markets').select('title_en, category, yes_prob, total_volume').eq('status', 'active').gte('created_at', since),
    supabase.from('bets').select('amount, side, status').gte('created_at', since),
    supabase.from('profiles').select('username').gte('created_at', since),
    supabase.from('leaderboard').select('username, total_won, balance').limit(5),
    supabase.from('markets').select('id, total_volume, participant_count, status'),
  ]);

  const betsVolume = bets24h?.reduce((sum, b) => sum + (b.amount ?? 0), 0) ?? 0;
  const wonBets = bets24h?.filter(b => b.status === 'won').length ?? 0;
  const totalVolume = platformStats?.reduce((sum, m) => sum + (m.total_volume ?? 0), 0) ?? 0;
  const totalParticipants = platformStats?.reduce((sum, m) => sum + (m.participant_count ?? 0), 0) ?? 0;
  const activeMarkets = platformStats?.filter(m => m.status === 'active').length ?? 0;

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F9FAFB; margin: 0; padding: 0; color: #111827; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .header { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; padding: 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
    .logo { font-size: 24px; color: #16A34A; font-weight: 900; }
    .title { font-size: 18px; font-weight: 700; color: #111827; }
    .subtitle { font-size: 13px; color: #6B7280; margin-top: 2px; }
    .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
    .card-title { font-size: 13px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .stat { background: #F9FAFB; border-radius: 8px; padding: 12px; }
    .stat-val { font-size: 22px; font-weight: 800; color: #111827; }
    .stat-label { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
    .market-row { padding: 10px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
    .market-row:last-child { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-yes { background: #F0FDF4; color: #16A34A; }
    .badge-no { background: #FEF2F2; color: #DC2626; }
    .badge-cat { background: #F3F4F6; color: #6B7280; }
    .winner-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
    .winner-row:last-child { border-bottom: none; }
    .rank { font-size: 11px; color: #9CA3AF; width: 20px; }
    .footer { text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 20px; }
    .green { color: #16A34A; font-weight: 700; }
  </style>
</head>
<body>
<div class="wrapper">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">◈ AçıkBazaar</div>
      <div class="title">Günlük Operasyon Raporu</div>
      <div class="subtitle">${today}</div>
    </div>
  </div>

  <!-- Platform Stats -->
  <div class="card">
    <div class="card-title">📊 Platform Özeti</div>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-val">${activeMarkets}</div>
        <div class="stat-label">Aktif Market</div>
      </div>
      <div class="stat">
        <div class="stat-val">◈${totalVolume.toLocaleString('tr-TR')}</div>
        <div class="stat-label">Toplam Hacim</div>
      </div>
      <div class="stat">
        <div class="stat-val">${totalParticipants.toLocaleString('tr-TR')}</div>
        <div class="stat-label">Toplam Katılımcı</div>
      </div>
      <div class="stat">
        <div class="stat-val">${newUsers?.length ?? 0}</div>
        <div class="stat-label">Yeni Kullanıcı (24s)</div>
      </div>
    </div>
  </div>

  <!-- 24h Bet Activity -->
  <div class="card">
    <div class="card-title">🎯 Son 24 Saatte Bahis</div>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-val">${bets24h?.length ?? 0}</div>
        <div class="stat-label">Bahis Sayısı</div>
      </div>
      <div class="stat">
        <div class="stat-val">◈${betsVolume.toLocaleString('tr-TR')}</div>
        <div class="stat-label">İşlem Hacmi</div>
      </div>
      <div class="stat">
        <div class="stat-val">${wonBets}</div>
        <div class="stat-label">Ödüllendirilen</div>
      </div>
      <div class="stat">
        <div class="stat-val">${bets24h?.filter(b => b.side === 'yes').length ?? 0} / ${bets24h?.filter(b => b.side === 'no').length ?? 0}</div>
        <div class="stat-label">EVET / HAYIR</div>
      </div>
    </div>
  </div>

  <!-- Resolved Markets -->
  ${resolvedToday && resolvedToday.length > 0 ? `
  <div class="card">
    <div class="card-title">✅ Bugün Resolve Edilen Marketler (${resolvedToday.length})</div>
    ${resolvedToday.map(m => `
      <div class="market-row">
        <span style="color:#374151; max-width: 380px;">${m.title_en}</span>
        <span class="badge ${m.outcome ? 'badge-yes' : 'badge-no'}">${m.outcome ? 'EVET' : 'HAYIR'}</span>
      </div>
    `).join('')}
  </div>
  ` : `
  <div class="card">
    <div class="card-title">✅ Resolve Edilen Market</div>
    <p style="color:#9CA3AF; font-size:13px; margin:0;">Bugün resolve edilen market yok.</p>
  </div>
  `}

  <!-- New Markets -->
  ${newMarkets && newMarkets.length > 0 ? `
  <div class="card">
    <div class="card-title">🆕 Bugün Üretilen Marketler (${newMarkets.length})</div>
    ${newMarkets.map(m => `
      <div class="market-row">
        <span style="color:#374151;">${m.title_en}</span>
        <span class="badge badge-cat">${m.category}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Top Winners -->
  ${topWinners && topWinners.length > 0 ? `
  <div class="card">
    <div class="card-title">🏆 Liderboard Top 5</div>
    ${topWinners.map((u, i) => `
      <div class="winner-row">
        <span class="rank">#${i + 1}</span>
        <span style="flex:1; font-weight:600;">${u.username}</span>
        <span style="color:#9CA3AF; font-size:12px;">${u.total_won} kazanç</span>
        <span class="green" style="margin-left:12px;">◈${(u.balance ?? 0).toLocaleString('tr-TR')}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    AçıkBazaar · acikbazaar.com · Gerçek para içermez<br/>
    Bu rapor otomatik olarak oluşturulmuştur.
  </div>
</div>
</body>
</html>
  `.trim();

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'AçıkBazaar <rapor@acikbazaar.com>',
    to: REPORT_EMAILS,
    subject: `◈ AçıkBazaar Günlük Rapor — ${today}`,
    html,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ sent: true, to: REPORT_EMAILS, date: today });
}
