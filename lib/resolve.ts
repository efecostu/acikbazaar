import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settleMarket, type WinInfo } from '@/lib/settle';
import { sendWinEmails } from '@/lib/notify';
import { topUpMarkets } from '@/lib/generate';

type MarketRow = {
  id: string; title_tr: string; title_en: string;
  description_tr: string | null; description_en: string | null;
  ends_at: string; kind: string | null; status: string;
};
type OptionRow = { id: string; label_tr: string; label_en: string; sort: number };

export type SweepResult = {
  fatal?: string;
  checked: { due: number; open: number };
  resolved: number;
  closed: number;
  skipped: number;
  errors: number;
  results: Record<string, unknown>[];
  topUp?: { before: number; generated: number; batches: { category: string; inserted: number; error?: string }[] };
};

/** Anthropic faturalama/anahtar hatası — tekrar denemek anlamsız, taramayı erken bitir. */
export function isBillingError(err: unknown): boolean {
  const msg = String(err);
  return /credit balance|billing|invalid x-api-key|authentication_error|ANTHROPIC_API_KEY missing/i.test(msg);
}

function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  return JSON.parse(match?.[0] ?? text);
}

/**
 * Günlük çözüm taraması:
 *  (a) süresi dolan marketler → web search ile araştır, karar ver, öde;
 *      karar verilemezse 'closed' (sonuç bekleniyor) durumuna al
 *  (b) hâlâ açık marketler → şimdiden kesinleşen var mı? (erken çözüm)
 *  (c) açık market sayısını hedefe tamamla (top-up)
 */
export async function runResolveSweep(admin: SupabaseClient, opts: { topUp?: boolean } = {}): Promise<SweepResult> {
  const client = new Anthropic();
  const nowIso = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  const { data: markets, error } = await admin
    .from('markets')
    .select('id, title_tr, title_en, description_tr, description_en, ends_at, kind, status')
    .in('status', ['active', 'closed']);
  if (error) throw new Error(error.message);

  const all = (markets ?? []) as MarketRow[];
  const due = all.filter((m) => {
    if (m.status === 'closed') return true;
    if (m.ends_at < nowIso) return true;
    const years = `${m.title_en} ${m.title_tr}`.match(/\b20\d{2}\b/g) ?? [];
    return years.some((y) => parseInt(y) < currentYear);
  });
  const open = all.filter((m) => !due.includes(m));

  const results: Record<string, unknown>[] = [];
  const wins: WinInfo[] = [];
  let closed = 0;
  let billingBlocked = false;

  const loadOptions = async (m: MarketRow): Promise<OptionRow[] | null> => {
    if (m.kind !== 'multi') return null;
    const { data } = await admin.from('market_options').select('id, label_tr, label_en, sort').eq('market_id', m.id).order('sort');
    return (data as OptionRow[]) ?? [];
  };

  // ---------- (a) Süresi dolanlar ----------
  for (const market of due) {
    try {
      const options = await loadOptions(market);
      const isMulti = !!options && options.length > 0;

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

outcome: true = YES happened, false = NO. If the deadline passed and the event did NOT happen, outcome is false.
If you cannot determine with confidence >= 0.7, set outcome to null.`;

      const response = await client.beta.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      });

      type DueVerdict = { outcome?: boolean | null; winning_index?: number | null; confidence: number; reasoning: string };
      const textContent = response.content.findLast((c) => c.type === 'text');
      let v: DueVerdict | null = null;
      if (textContent?.type === 'text') {
        try { v = extractJson(textContent.text) as DueVerdict; } catch { v = null; }
      }

      const decided = v !== null && (isMulti
        ? v.winning_index !== null && v.winning_index !== undefined && options![v.winning_index] !== undefined
        : v.outcome !== null && v.outcome !== undefined);

      if (v === null || !decided || v.confidence < 0.7) {
        // Karar yok → market 'closed' (sonuç bekleniyor); yarın tekrar denenir, bahis alınmaz
        if (market.status !== 'closed') {
          await admin.from('markets').update({ status: 'closed' }).eq('id', market.id);
          closed++;
        }
        results.push({ market: market.title_en, path: 'due', status: 'skipped', reason: v ? `low confidence ${v.confidence}` : 'no verdict', reasoning: v?.reasoning });
        continue;
      }

      const winningOption = isMulti ? options![v.winning_index!] : null;
      const settled = await settleMarket(admin, market.id, {
        outcome: isMulti ? null : v.outcome!,
        winningOptionId: winningOption?.id ?? null,
        reasoning: v.reasoning,
      });
      wins.push(...settled.wins);
      results.push({
        market: market.title_en, path: 'due', status: 'resolved',
        outcome: isMulti ? winningOption!.label_en : v.outcome,
        confidence: v.confidence, reasoning: v.reasoning,
        winners: settled.winners, losers: settled.losers,
      });
    } catch (err) {
      results.push({ market: market.title_en, path: 'due', status: 'error', reason: String(err) });
      if (isBillingError(err)) { billingBlocked = true; break; }
    }
  }

  // ---------- (b) Erken kesinleşme taraması ----------
  if (open.length > 0 && !billingBlocked) {
    try {
      const openWithOptions = await Promise.all(open.map(async (m) => ({ m, options: await loadOptions(m) })));

      const listing = openWithOptions.map(({ m, options }, i) => {
        const opts = options?.length ? `\n   Options: ${options.map((o, j) => `${j}:${o.label_tr}`).join(' | ')}` : '';
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
        model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: earlyPrompt }],
      });

      const textContent = response.content.findLast((c) => c.type === 'text');
      const verdicts = textContent?.type === 'text'
        ? (extractJson(textContent.text) as { index: number; outcome: boolean | null; winning_index: number | null; confidence: number; reasoning: string }[])
        : [];

      for (const v of Array.isArray(verdicts) ? verdicts : []) {
        const entry = openWithOptions[v.index];
        if (!entry || v.confidence < 0.9) continue;
        const { m, options } = entry;
        const isMulti = !!options && options.length > 0;
        const winningOption = isMulti && v.winning_index !== null && options![v.winning_index] ? options![v.winning_index] : null;
        if (isMulti && !winningOption) continue;
        if (!isMulti && (v.outcome === null || v.outcome === undefined)) continue;

        const settled = await settleMarket(admin, m.id, {
          outcome: isMulti ? null : v.outcome!,
          winningOptionId: winningOption?.id ?? null,
          reasoning: `[Erken çözüm] ${v.reasoning}`,
        });
        wins.push(...settled.wins);
        results.push({
          market: m.title_en, path: 'early', status: 'resolved',
          outcome: isMulti ? winningOption!.label_en : v.outcome,
          confidence: v.confidence, reasoning: v.reasoning,
          winners: settled.winners, losers: settled.losers,
        });
      }
    } catch (err) {
      results.push({ path: 'early', status: 'error', reason: String(err) });
      if (isBillingError(err)) billingBlocked = true;
    }
  }

  await sendWinEmails(admin, wins);

  // ---------- (c) Açık market sayısını hedefe tamamla ----------
  let topUp: SweepResult['topUp'];
  if (opts.topUp !== false && !billingBlocked) {
    try {
      topUp = await topUpMarkets(admin);
    } catch (err) {
      results.push({ path: 'topup', status: 'error', reason: String(err) });
    }
  }

  return {
    ...(billingBlocked ? { fatal: 'Anthropic API kullanılamıyor (kredi bitti / anahtar geçersiz). Plans & Billing kontrol et.' } : {}),
    checked: { due: due.length, open: open.length },
    resolved: results.filter((r) => r.status === 'resolved').length,
    closed,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
    topUp,
  };
}
