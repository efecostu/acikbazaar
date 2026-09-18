import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SweepResult } from '@/lib/resolve';

/** Alıcılar: REPORT_EMAILS (virgülle ayrılmış) → ADMIN_EMAIL → eski raporun varsayılan listesi. */
const DEFAULT_RECIPIENTS = ['efecostu01@gmail.com', 'eminaliozturk@gmail.com'];
function recipients(): string[] {
  const raw = process.env.REPORT_EMAILS ?? process.env.ADMIN_EMAIL ?? '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_RECIPIENTS;
}

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://acikbazaar.com';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
const n = (x: number) => (x ?? 0).toLocaleString('tr-TR');
const dt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

type Row = { title_tr: string; id: string };
type Who = { username: string; is_bot: boolean };
type Joined<T> = T & { profiles: Who | Who[]; markets: { title_tr: string } | { title_tr: string }[] };
const one = <T,>(x: T | T[]): T => (Array.isArray(x) ? x[0] : x);

/**
 * Gece raporu: cron'un o gece yaptığı her şey (sweep sonucu) + son 24 saatin veritabanı hareketleri.
 * sweep verilmezse yalnızca DB'ye bakar (manuel /api/cron/report).
 */
export async function sendDailyReport(admin: SupabaseClient, sweep?: SweepResult) {
  const to = recipients();
  if (!to.length) return { sent: false, reason: 'REPORT_EMAILS / ADMIN_EMAIL tanımlı değil' };

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

  const [
    { data: resolved }, { data: newMarkets }, { data: closedAwaiting }, { data: betRows }, { data: commentRows },
    { data: newUsers }, { data: board }, { data: pendingSugg }, { data: endingSoon }, { data: allMarkets },
  ] = await Promise.all([
    admin.from('markets').select('id, title_tr, outcome, resolution_note, resolved_at').eq('status', 'resolved').gte('resolved_at', since).order('resolved_at', { ascending: false }),
    admin.from('markets').select('id, title_tr, category, ends_at, yes_prob').gte('created_at', since).order('created_at', { ascending: false }),
    admin.from('markets').select('id, title_tr, ends_at').eq('status', 'closed').order('ends_at'),
    admin.from('bets').select('amount, side, created_at, profiles!inner(username, is_bot), markets!inner(title_tr)').gte('created_at', since).order('created_at', { ascending: false }),
    admin.from('comments').select('content, created_at, profiles!inner(username, is_bot), markets!inner(title_tr)').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
    admin.from('profiles').select('username, referred_by, created_at').eq('is_bot', false).gte('created_at', since),
    admin.from('leaderboard').select('username, is_bot, profit, unrealized, open_positions, balance').limit(8),
    admin.from('market_suggestions').select('id, title_tr').eq('status', 'pending'),
    admin.from('markets').select('id, title_tr, ends_at, yes_prob').eq('status', 'active').lte('ends_at', new Date(Date.now() + 3 * 864e5).toISOString()).order('ends_at'),
    admin.from('markets').select('status, total_volume'),
  ]);

  const bets = ((betRows ?? []) as unknown as Joined<{ amount: number; side: string; created_at: string }>[]).map((b) => ({ ...b, p: one(b.profiles), m: one(b.markets) }));
  const comments = ((commentRows ?? []) as unknown as Joined<{ content: string; created_at: string }>[]).map((c) => ({ ...c, p: one(c.profiles), m: one(c.markets) }));
  const humanBets = bets.filter((b) => !b.p?.is_bot);
  const botBets = bets.filter((b) => b.p?.is_bot);
  const humanComments = comments.filter((c) => !c.p?.is_bot);
  const botComments = comments.filter((c) => c.p?.is_bot);
  const active = (allMarkets ?? []).filter((m) => m.status === 'active').length;
  const totalVolume = (allMarkets ?? []).reduce((s, m) => s + (m.total_volume ?? 0), 0);

  // Cron'un bu gece yaptıkları
  const sw = sweep?.results ?? [];
  const swResolved = sw.filter((r) => r.status === 'resolved');
  const swSkipped = sw.filter((r) => r.status === 'skipped' || r.status === 'closed');
  const swErrors = sw.filter((r) => r.status === 'error');
  const generated = sweep?.topUp?.batches?.filter((b) => b.inserted > 0) ?? [];

  const link = (m: Row) => `<a href="${APP}/markets/${m.id}" style="color:#111827;text-decoration:none">${esc(m.title_tr)}</a>`;
  const adminLink = (m: Row) => `<a href="${APP}/admin/markets/${m.id}" style="color:#6B7280;font-size:11px">admin</a>`;
  const card = (title: string, body: string) => `<div class="card"><div class="card-title">${title}</div>${body}</div>`;
  const empty = (t: string) => `<p class="muted">${t}</p>`;
  const badge = (yes: boolean | null) => (yes === null ? '' : `<span class="badge ${yes ? 'b-yes' : 'b-no'}">${yes ? 'EVET' : 'HAYIR'}</span>`);

  const alerts: string[] = [];
  if (sweep?.fatal) alerts.push(`Cron durdu: ${esc(sweep.fatal)}`);
  if (swErrors.length) alerts.push(`${swErrors.length} hata (aşağıda)`);
  const earlyCount = swResolved.filter((r) => r.path === 'early').length;
  if (earlyCount) alerts.push(`${earlyCount} market ERKEN çözüldü, gerekçeyi kontrol et`);
  if ((closedAwaiting?.length ?? 0) > 0) alerts.push(`${closedAwaiting!.length} market sonuç bekliyor (admin kararı gerekli)`);
  if ((pendingSugg?.length ?? 0) > 0) alerts.push(`${pendingSugg!.length} kullanıcı önerisi onay bekliyor`);
  if (active < 12) alerts.push(`Açık market sayısı düşük: ${active}`);

  const resolvedSection = sweep
    ? (swResolved.length
      ? swResolved.map((r) => {
          const m = (resolved ?? []).find((x) => x.title_tr === r.market || x.id === r.market_id) as (Row & { outcome: boolean | null }) | undefined;
          const title = m ? link(m) : esc(r.market);
          const oc = typeof r.outcome === 'boolean' ? badge(r.outcome) : `<span class="badge b-cat">${esc(r.outcome)}</span>`;
          const conf = Math.round(((r.confidence as number) ?? 0) * 100);
          return `<div class="row">${title}${oc}${r.path === 'early' ? '<span class="badge b-early">ERKEN</span>' : ''}<div class="meta">güven %${conf} · ${r.winners ?? 0} kazanan / ${r.losers ?? 0} kaybeden · ${esc(r.reasoning)}${m ? ` · ${adminLink(m)}` : ''}</div></div>`;
        }).join('')
      : empty('Bu gece çözülen market yok.'))
    : ((resolved?.length)
      ? resolved.map((m) => `<div class="row">${link(m)}${badge(m.outcome)}<div class="meta">${esc(m.resolution_note)} · ${adminLink(m)}</div></div>`).join('')
      : empty('Son 24 saatte çözülen market yok.'));

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F3F4F6;margin:0;color:#111827}
.wrap{max-width:640px;margin:0 auto;padding:20px 12px}
.card{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 18px;margin-bottom:12px}
.card-title{font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.row{padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;line-height:1.4}.row:last-child{border-bottom:none}
.meta{font-size:11px;color:#9CA3AF;margin-top:2px}.muted{color:#9CA3AF;font-size:13px;margin:0}
.badge{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-left:6px;vertical-align:middle}
.b-yes{background:#F0FDF4;color:#16A34A}.b-no{background:#FEF2F2;color:#DC2626}.b-early{background:#FFFBEB;color:#B45309}.b-cat{background:#F3F4F6;color:#6B7280}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.stat{background:#F9FAFB;border-radius:8px;padding:10px}.v{font-size:20px;font-weight:800}.l{font-size:11px;color:#9CA3AF}
.alert{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;font-size:13px;color:#92400E;margin-bottom:12px}
.q{font-size:13px;color:#374151;padding:6px 0;border-bottom:1px solid #F3F4F6}.q:last-child{border:none}.u{font-weight:600;color:#111827}
.pos{color:#16A34A;font-weight:700}.neg{color:#DC2626;font-weight:700}
</style></head><body><div class="wrap">
<div class="card"><div style="font-size:20px;font-weight:900;color:#16A34A">◈ AçıkBazaar</div><div style="font-size:17px;font-weight:700">Gece raporu: ne değişti</div><div class="meta">${today} · <a href="${APP}/admin" style="color:#6B7280">admin panel</a> · <a href="${APP}/activity" style="color:#6B7280">akış</a></div></div>

${alerts.length ? `<div class="alert"><b>Dikkat</b><br/>${alerts.map((a) => `• ${a}`).join('<br/>')}</div>` : ''}

<div class="card"><div class="grid">
<div class="stat"><div class="v">${active}</div><div class="l">açık market</div></div>
<div class="stat"><div class="v">${n(humanBets.length)}</div><div class="l">kullanıcı bahsi / 24s</div></div>
<div class="stat"><div class="v">${n(botBets.length)}</div><div class="l">bot bahsi / 24s</div></div>
<div class="stat"><div class="v">${newUsers?.length ?? 0}</div><div class="l">yeni kullanıcı</div></div>
<div class="stat"><div class="v">${n(humanComments.length)} / ${n(botComments.length)}</div><div class="l">yorum: insan / bot</div></div>
<div class="stat"><div class="v">◈${n(totalVolume)}</div><div class="l">toplam hacim</div></div>
</div></div>

${card(`Cron: çözülen marketler (${sweep ? swResolved.length : resolved?.length ?? 0})`, resolvedSection)}
${sweep && swSkipped.length ? card(`Cron: karar verilemeyen (${swSkipped.length})`, swSkipped.map((r) => `<div class="row">${esc(r.market)}<div class="meta">${esc(r.reason)}${r.reasoning ? ` · ${esc(r.reasoning)}` : ''}</div></div>`).join('')) : ''}
${sweep && swErrors.length ? card(`Cron: hatalar (${swErrors.length})`, swErrors.map((r) => `<div class="row" style="color:#DC2626">${esc(r.market ?? r.path)}<div class="meta">${esc(r.reason)}</div></div>`).join('')) : ''}

${card(`Yeni marketler (${newMarkets?.length ?? 0})${generated.length ? ` · cron üretti: ${generated.map((g) => `${g.category} ${g.inserted}`).join(', ')}` : ''}`,
  (newMarkets?.length) ? newMarkets.map((m) => `<div class="row">${link(m)}<span class="badge b-cat">${esc(m.category)}</span><div class="meta">bitiş ${dt(m.ends_at)} · başlangıç EVET %${Math.round((m.yes_prob ?? 0.5) * 100)}</div></div>`).join('') : empty('Yeni market eklenmedi.'))}

${closedAwaiting?.length ? card(`Sonuç bekleyen (${closedAwaiting.length})`, closedAwaiting.map((m) => `<div class="row">${link(m)}<div class="meta">vade ${dt(m.ends_at)} · ${adminLink(m)}</div></div>`).join('')) : ''}
${endingSoon?.length ? card(`3 gün içinde kapanacak (${endingSoon.length})`, endingSoon.map((m) => `<div class="row">${link(m)}<div class="meta">${dt(m.ends_at)} · EVET %${Math.round(m.yes_prob * 100)}</div></div>`).join('')) : ''}

${card(`Kullanıcı bahisleri (${humanBets.length})`, humanBets.length ? humanBets.slice(0, 40).map((b) => `<div class="row"><span class="u">${esc(b.p?.username)}</span> ${b.side === 'yes' ? 'EVET' : 'HAYIR'} ◈${n(b.amount)} · ${esc(b.m?.title_tr)}<div class="meta">${dt(b.created_at)}</div></div>`).join('') : empty('Gerçek kullanıcı bahsi yok.'))}
${card(`Kullanıcı yorumları (${humanComments.length})`, humanComments.length ? humanComments.slice(0, 30).map((c) => `<div class="q"><span class="u">${esc(c.p?.username)}</span> · ${esc(c.m?.title_tr)}<br/>${esc(c.content)}</div>`).join('') : empty('Kullanıcı yorumu yok.'))}
${card(`Bot yorumlarından örnekler (${botComments.length} toplam)`, botComments.length ? botComments.slice(0, 8).map((c) => `<div class="q"><span class="u">${esc(c.p?.username)}</span> · ${esc(c.m?.title_tr)}<br/>${esc(c.content)}</div>`).join('') : empty('Bot yorumu yok.'))}

${newUsers?.length ? card(`Yeni kullanıcılar (${newUsers.length})`, newUsers.map((u) => `<div class="row"><span class="u">${esc(u.username)}</span>${u.referred_by ? '<span class="badge b-cat">davet</span>' : ''}<div class="meta">${dt(u.created_at)}</div></div>`).join('')) : ''}
${pendingSugg?.length ? card(`Onay bekleyen öneriler (${pendingSugg.length})`, pendingSugg.map((s) => `<div class="row">${esc(s.title_tr)}</div>`).join('') + `<div class="meta"><a href="${APP}/admin/suggestions" style="color:#6B7280">admin/suggestions</a></div>`) : ''}

${card('Sıralama (canlı kâr, açık pozisyonlar dahil)', (board ?? []).map((u, i) => `<div class="row">#${i + 1} <span class="u">${esc(u.username)}</span>${u.is_bot ? '<span class="badge b-cat">bot</span>' : ''} <span class="${u.profit >= 0 ? 'pos' : 'neg'}" style="float:right">${u.profit >= 0 ? '+' : ''}◈${n(u.profit)}</span><div class="meta">${u.open_positions ?? 0} açık pozisyon · açık k/z ${(u.unrealized ?? 0) >= 0 ? '+' : ''}${n(u.unrealized ?? 0)} · bakiye ◈${n(u.balance)}</div></div>`).join(''))}

<div style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:16px">AçıkBazaar · gerçek para içermez · bu rapor cron bittikten sonra otomatik gönderilir</div>
</div></body></html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = `◈ AçıkBazaar gece raporu — ${today}: ${swResolved.length || resolved?.length || 0} çözüm, ${newMarkets?.length ?? 0} yeni market, ${humanBets.length} kullanıcı bahsi${alerts.length ? ' · DİKKAT' : ''}`;

  const { error } = await resend.emails.send({ from: 'AçıkBazaar <rapor@acikbazaar.com>', to, subject, html });
  if (error && /not verified|verify/i.test(error.message)) {
    const { error: e2 } = await resend.emails.send({ from: 'AçıkBazaar <onboarding@resend.dev>', to: to[0], subject: `${subject} (domain doğrulanana kadar tek alıcı)`, html });
    if (e2) throw new Error(e2.message);
    return { sent: true, to: [to[0]], fallback: true };
  }
  if (error) throw new Error(error.message);
  return { sent: true, to };
}
