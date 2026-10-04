import { Resend } from 'resend';
import type { Agent } from '../core';
import { syncBots } from './bots';

/**
 * Günlük sağlık kontrolü (2026-10-04 test ajanlarının DB kontrollerinin otomatik hali).
 * Sorun bulursa ADMIN_EMAIL'e kısa e-posta atar (RESEND_API_KEY varsa); kayıtlar 90 günde budanır.
 */
export const ops: Agent = {
  name: 'ops',
  everyMin: 24 * 60,
  async run(db) {
    const now = Date.now();
    const dayAgo = new Date(now - 864e5).toISOString();
    const issues: string[] = [];

    const [overdue, newest, botBets, runs, resolvedIds, users, profiles] = await Promise.all([
      db.from('markets').select('id, title_tr, ends_at').in('status', ['active', 'closed']).lt('ends_at', new Date(now - 864e5).toISOString()),
      db.from('markets').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('bets').select('id, profiles!inner(is_bot)', { count: 'exact', head: true }).eq('profiles.is_bot', true).gte('created_at', dayAgo),
      db.from('agent_runs').select('agent, ok, error').gte('started_at', dayAgo),
      db.from('markets').select('id').eq('status', 'resolved'),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from('profiles').select('id'),
    ]);

    const overdueList = overdue.data ?? [];
    if (overdueList.length) issues.push(`${overdueList.length} market bitişinden 24 saat sonra hâlâ çözülmedi: ${overdueList.slice(0, 3).map((m) => m.title_tr).join(' | ')}`);

    const hoursSinceNew = newest.data ? (now - new Date(newest.data.created_at).getTime()) / 36e5 : Infinity;
    if (hoursSinceNew > 72) issues.push(`${Math.round(hoursSinceNew)} saattir yeni market açılmadı`);

    if ((botBets.count ?? 0) < 20) issues.push(`son 24 saatte sadece ${botBets.count ?? 0} bot bahsi`);

    const perAgent = new Map<string, { ok: number; fail: number; lastError?: string }>();
    for (const r of runs.data ?? []) {
      const s = perAgent.get(r.agent) ?? { ok: 0, fail: 0 };
      if (r.ok) s.ok++; else if (r.ok === false) { s.fail++; s.lastError = r.error ?? undefined; }
      perAgent.set(r.agent, s);
    }
    for (const [agent, s] of perAgent) {
      if (s.fail > 0 && s.fail >= s.ok) issues.push(`${agent} ajanı 24 saatte ${s.fail} kez hata verdi: ${s.lastError?.slice(0, 120)}`);
    }

    const ids = (resolvedIds.data ?? []).map((m) => m.id);
    if (ids.length) {
      const { count } = await db.from('bets').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('market_id', ids);
      if (count) issues.push(`çözülmüş marketlerde ${count} bekleyen bahis var (ödeme kaçmış olabilir)`);
    }

    const profileIds = new Set((profiles.data ?? []).map((p) => p.id));
    const orphans = (users.data?.users ?? []).filter((u) => !profileIds.has(u.id));
    if (orphans.length) issues.push(`${orphans.length} kullanıcının profili yok (kayıt tetikleyicisi bozuk olabilir)`);

    const bots = await syncBots(db);
    if (bots.errors.length) issues.push(`bot eşitleme hataları: ${bots.errors.join('; ').slice(0, 200)}`);
    await db.rpc('prune_agent_data');

    let emailed = false;
    const to = (process.env.REPORT_EMAILS ?? process.env.ADMIN_EMAIL ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (issues.length && process.env.RESEND_API_KEY && to.length) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.REPORT_FROM ?? 'AçıkBazaar Ajanlar <onboarding@resend.dev>',
        to: to.slice(0, 1),
        subject: `◈ AçıkBazaar ajan uyarısı: ${issues.length} sorun`,
        html: `<ul>${issues.map((i) => `<li>${i.replace(/</g, '&lt;')}</li>`).join('')}</ul>`,
      });
      emailed = !error;
    }

    return {
      issues,
      emailed,
      agents: Object.fromEntries(perAgent),
      botBets24h: botBets.count ?? 0,
      hoursSinceNewMarket: Math.round(hoursSinceNew),
      bots,
    };
  },
};
