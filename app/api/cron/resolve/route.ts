import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { sendWinEmails } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // web search'lü çözümler uzun sürebilir

const client = new Anthropic();

type Win = { userId: string; marketTitle: string; amount: number; payout: number; pick: string };
type Verdict = { outcome: boolean | null; winningOption: { id: string; label_tr: string; label_en: string } | null; reasoning: string };

/**
 * Bir marketi çözer: statü + kazanan seçenek + bahis ödemeleri.
 * Hem "süresi doldu" hem "erken kesinleşti" yolları bunu kullanır.
 */
async function settleMarket(
  supabase: SupabaseClient,
  market: { id: string; title_tr: string; title_en: string },
  verdict: Verdict,
  wins: Win[],
) {
  await supabase.from('markets').update({
    status: 'resolved',
    outcome: verdict.outcome,
    winning_option_id: verdict.winningOption?.id ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', market.id);

  // Karar gerekçesini sakla (kolon yoksa sessizce geçer — opsiyonel migration)
  await supabase.from('markets').update({ resolution_note: verdict.reasoning }).eq('id', market.id);

  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', market.id)
    .eq('status', 'pending');

  let winners = 0;
  let losers = 0;

  for (const bet of bets ?? []) {
    const won = verdict.winningOption
      ? bet.option_id === verdict.winningOption.id
      : (bet.side === 'yes' && verdict.outcome === true) || (bet.side === 'no' && verdict.outcome === false);

    const settled_at = new Date().toISOString();
    if (won) {
      await supabase.from('bets').update({ status: 'won', settled_at }).eq('id', bet.id);
      await supabase.rpc('credit_and_update_user', {
        p_user_id: bet.user_id,
        p_amount: bet.potential_payout,
      });
      wins.push({
        userId: bet.user_id,
        marketTitle: market.title_tr,
        amount: bet.amount,
        payout: bet.potential_payout,
        pick: verdict.winningOption ? verdict.winningOption.label_tr : (bet.side === 'yes' ? 'EVET' : 'HAYIR'),
      });
      winners++;
    } else {
      await supabase.from('bets').update({ status: 'lost', settled_at }).eq('id', bet.id);
      losers++;
    }
  }
  return { winners, losers, bets_settled: bets?.length ?? 0 };
}

function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  return JSON.parse(match?.[0] ?? text);
}

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

  const { data: activeMarkets, error: fetchError } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'active');

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  // İki grup: (a) süresi dolmuş/bayat başlıklı → çözülmek ZORUNDA,
  // (b) hâlâ açık → "şimdiden kesinleşti mi?" erken taraması
  const due = (activeMarkets ?? []).filter((m) => {
    if (m.ends_at < nowIso) return true;
    const years = `${m.title_en} ${m.title_tr}`.match(/\b20\d{2}\b/g) ?? [];
    return years.some((y: string) => parseInt(y) < currentYear);
  });
  const open = (activeMarkets ?? []).filter((m) => !due.includes(m));

  const results: Record<string, unknown>[] = [];
  const wins: Win[] = [];

  // ---------- (a) Süresi dolanlar: market başına derin araştırma ----------
  for (const market of due) {
    try {
      const { data: options } = market.kind === 'multi'
        ? await supabase.from('market_options').select('*').eq('market_id', market.id).order('sort')
        : { data: null };
      const isMulti = market.kind === 'multi' && (options?.length ?? 0) > 0;

      const prompt = isMulti
        ? `You are resolving a multiple-choice prediction market. Research which option won.

Question (TR): ${market.title_tr}
Question (EN): ${market.title_en}
Options:
${options!.map((o, i) => `${i}: ${o.label_tr} / ${o.label_en}`).join('\n')}
Market end date: ${market.ends_at}
Today: ${nowIso}

Search for recent news, then respond with ONLY a JSON object (no other text):
{"winning_index": 0, "confidence": 0.9, "reasoning": "One sentence with source"}

If you cannot determine with confidence >= 0.7, set winning_index to null.`
        : `You are resolving a binary prediction market. Research whether this event occurred.

Question (EN): ${market.title_en}
Question (TR): ${market.title_tr}
${market.description_en ? `Resolution criteria: ${market.description_en}` : ''}
Market end date: ${market.ends_at}
Today: ${nowIso}

Search for recent news and facts, then respond with ONLY a JSON object (no other text):
{"outcome": true, "confidence": 0.9, "reasoning": "One sentence explanation with source"}

outcome: true = YES happened, false = NO. If you cannot determine with confidence >= 0.7, set outcome to null.`;

      const response = await client.beta.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.findLast((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        results.push({ market: market.title_en, path: 'due', status: 'skipped', reason: 'no text' });
        continue;
      }

      let v: { outcome?: boolean | null; winning_index?: number | null; confidence: number; reasoning: string };
      try {
        v = extractJson(textContent.text) as typeof v;
      } catch {
        results.push({ market: market.title_en, path: 'due', status: 'error', reason: 'JSON parse failed' });
        continue;
      }

      const decided = isMulti
        ? v.winning_index !== null && v.winning_index !== undefined && options![v.winning_index] !== undefined
        : v.outcome !== null && v.outcome !== undefined;

      if (!decided || v.confidence < 0.7) {
        results.push({ market: market.title_en, path: 'due', status: 'skipped', reason: `low confidence ${v.confidence}`, reasoning: v.reasoning });
        continue;
      }

      const winningOption = isMulti ? options![v.winning_index!] : null;
      const settled = await settleMarket(supabase, market, {
        outcome: isMulti ? null : v.outcome!,
        winningOption,
        reasoning: v.reasoning,
      }, wins);

      results.push({
        market: market.title_en, path: 'due', status: 'resolved',
        outcome: isMulti ? winningOption!.label_en : v.outcome,
        confidence: v.confidence, reasoning: v.reasoning, ...settled,
      });
    } catch (err) {
      results.push({ market: market.title_en, path: 'due', status: 'error', reason: String(err) });
    }
  }

  // ---------- (b) Erken kesinleşme taraması: tek toplu çağrı ----------
  // Örn. "Antalya Temmuz'da 40°C görür mü?" — 40°C 10 Temmuz'da görüldüyse
  // market 1 Ağustos'u beklemeden EVET olarak kapanmalı.
  if (open.length > 0) {
    try {
      const openWithOptions = await Promise.all(open.map(async (m) => {
        if (m.kind !== 'multi') return { m, options: null };
        const { data } = await supabase.from('market_options').select('*').eq('market_id', m.id).order('sort');
        return { m, options: data };
      }));

      const listing = openWithOptions.map(({ m, options }, i) => {
        const opts = options?.length
          ? `\n   Options: ${options.map((o, j) => `${j}:${o.label_tr}`).join(' | ')}`
          : '';
        return `${i}. [ends ${m.ends_at.slice(0, 10)}] ${m.title_tr} / ${m.title_en}${m.description_tr ? `\n   Criteria: ${m.description_tr}` : ''}${opts}`;
      }).join('\n');

      const earlyPrompt = `Today is ${nowIso.slice(0, 10)}. Below are ACTIVE prediction markets that have NOT reached their end date yet.

Your job: identify which of them are ALREADY DECIDED — the outcome is now certain regardless of what happens before the end date. Example: "Will Antalya see 40°C in July?" is decided YES the moment 40°C is recorded, even if July isn't over. A market is NOT decided if the event could still go either way.

Markets:
${listing}

Use web search to verify. Respond with ONLY a JSON array (no other text) containing ONLY markets that are certainly decided with confidence >= 0.9:
[{"index": 0, "outcome": true, "winning_index": null, "confidence": 0.95, "reasoning": "short, with source"}]

- "outcome": true/false for YES/NO markets, null for multi-option markets
- "winning_index": option index for multi-option markets, null otherwise
- Be conservative: when in doubt, leave the market out. Return [] if none are decided.`;

      const response = await client.beta.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: earlyPrompt }],
      });

      const textContent = response.content.findLast((c) => c.type === 'text');
      const earlyVerdicts = textContent?.type === 'text'
        ? (extractJson(textContent.text) as { index: number; outcome: boolean | null; winning_index: number | null; confidence: number; reasoning: string }[])
        : [];

      for (const v of Array.isArray(earlyVerdicts) ? earlyVerdicts : []) {
        const entry = openWithOptions[v.index];
        if (!entry || v.confidence < 0.9) continue;
        const { m, options } = entry;

        const isMulti = m.kind === 'multi' && (options?.length ?? 0) > 0;
        const winningOption = isMulti && v.winning_index !== null && options![v.winning_index] !== undefined
          ? options![v.winning_index]
          : null;
        if (isMulti && !winningOption) continue;
        if (!isMulti && (v.outcome === null || v.outcome === undefined)) continue;

        const settled = await settleMarket(supabase, m, {
          outcome: isMulti ? null : v.outcome!,
          winningOption,
          reasoning: `[Erken çözüm] ${v.reasoning}`,
        }, wins);

        results.push({
          market: m.title_en, path: 'early', status: 'resolved',
          outcome: isMulti ? winningOption!.label_en : v.outcome,
          confidence: v.confidence, reasoning: v.reasoning, ...settled,
        });
      }
    } catch (err) {
      results.push({ path: 'early', status: 'error', reason: String(err) });
    }
  }

  await sendWinEmails(supabase, wins);

  // Çözülen her market için yenisini üret
  const resolvedCount = results.filter((r) => r.status === 'resolved').length;
  if (resolvedCount > 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const categories = ['economy', 'sports', 'politics', 'tech', 'entertainment', 'weather'];
      const randomCat = categories[Math.floor(Math.random() * categories.length)];
      await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET! },
        body: JSON.stringify({ region: 'turkey', category: randomCat, count: Math.min(resolvedCount, 3) }),
      });
    } catch { /* üretim hatası cron'u düşürmesin */ }
  }

  return Response.json({
    checked: { due: due.length, open: open.length },
    resolved: resolvedCount,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  });
}
