import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { sendWinEmails } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const client = new Anthropic();

export async function GET() {
  const headerStore = await headers();

  // Accept both Vercel Cron token and manual admin calls
  const authHeader = headerStore.get('authorization');
  const adminHeader = headerStore.get('x-admin-secret');
  const cronToken = authHeader?.replace('Bearer ', '');

  const isVercelCron = !!process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;
  const isAdmin = adminHeader === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createAdminClient();

  // Günlük kalite kontrolü: süresi dolanlar + başlığı geçmiş yıla referans verenler.
  // (Eski seed'ler "2025..." başlıklı ama ends_at ileri tarihli olabiliyordu — onlar da çözülür.)
  const { data: activeMarkets, error: fetchError } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'active');

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const currentYear = new Date().getFullYear();
  const expiredMarkets = (activeMarkets ?? []).filter((m) => {
    if (m.ends_at < nowIso) return true;
    const years = `${m.title_en} ${m.title_tr}`.match(/\b20\d{2}\b/g) ?? [];
    return years.some((y: string) => parseInt(y) < currentYear);
  });

  if (expiredMarkets.length === 0) {
    return Response.json({ message: 'No expired or stale markets', resolved: 0 });
  }

  const results: Record<string, unknown>[] = [];
  const wins: { userId: string; marketTitle: string; amount: number; payout: number; pick: string }[] = [];

  for (const market of expiredMarkets) {
    try {
      // Çoklu-seçenekli marketlerde Claude kazanan seçeneği belirler
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
Today: ${new Date().toISOString()}

Search for recent news, then respond with ONLY a JSON object (no other text):
{"winning_index": 0, "confidence": 0.9, "reasoning": "One sentence with source"}

Rules:
- winning_index: the 0-based index of the winning option
- confidence: 0.0 to 1.0 based on your search results
- If you cannot determine with confidence >= 0.7, set winning_index to null`
        : `You are resolving a binary prediction market. Research whether this event occurred.

Question (EN): ${market.title_en}
Question (TR): ${market.title_tr}
${market.description_en ? `Resolution criteria: ${market.description_en}` : ''}
Market end date: ${market.ends_at}
Today: ${new Date().toISOString()}

Search for recent news and facts, then respond with ONLY a JSON object (no other text):
{"outcome": true, "confidence": 0.9, "reasoning": "One sentence explanation with source"}

Rules:
- outcome: true = YES happened, false = NO / did not happen
- confidence: 0.0 to 1.0 (how sure you are based on search results)
- If you cannot determine with confidence >= 0.7, set outcome to null`;

      const response = await client.beta.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.findLast((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        results.push({ market_id: market.id, status: 'skipped', reason: 'No text from Claude' });
        continue;
      }

      let verdict: { outcome?: boolean | null; winning_index?: number | null; confidence: number; reasoning: string };
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*?\}/);
        verdict = JSON.parse(jsonMatch?.[0] ?? '{}');
      } catch {
        results.push({ market_id: market.id, status: 'error', reason: 'JSON parse failed' });
        continue;
      }

      const decided = isMulti
        ? verdict.winning_index !== null && verdict.winning_index !== undefined && options![verdict.winning_index] !== undefined
        : verdict.outcome !== null && verdict.outcome !== undefined;

      if (!decided || verdict.confidence < 0.7) {
        results.push({ market_id: market.id, status: 'skipped', reason: `Low confidence: ${verdict.confidence}`, reasoning: verdict.reasoning });
        continue;
      }

      const winningOption = isMulti ? options![verdict.winning_index!] : null;

      await supabase.from('markets').update({
        status: 'resolved',
        outcome: isMulti ? null : verdict.outcome,
        winning_option_id: winningOption?.id ?? null,
        resolved_at: new Date().toISOString(),
      }).eq('id', market.id);

      const { data: bets } = await supabase
        .from('bets')
        .select('*')
        .eq('market_id', market.id)
        .eq('status', 'pending');

      let winners = 0;
      let losers = 0;

      for (const bet of bets ?? []) {
        const won = isMulti
          ? bet.option_id === winningOption!.id
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
            pick: isMulti ? winningOption!.label_tr : (bet.side === 'yes' ? 'EVET' : 'HAYIR'),
          });
          winners++;
        } else {
          await supabase.from('bets').update({ status: 'lost', settled_at }).eq('id', bet.id);
          losers++;
        }
      }

      results.push({
        market_id: market.id,
        title: market.title_en,
        outcome: isMulti ? winningOption!.label_en : verdict.outcome,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        bets_settled: (bets?.length ?? 0),
        winners,
        losers,
      });

    } catch (err) {
      results.push({ market_id: market.id, status: 'error', reason: String(err) });
    }
  }

  // Kazananlara e-posta bildirimi (bloklamaz, hata yutar)
  await sendWinEmails(supabase, wins);

  // Auto-generate replacement markets for every resolved market
  const resolvedCount = results.filter((r) => 'outcome' in r && r.outcome !== undefined).length;

  if (resolvedCount > 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const categories = ['economy', 'sports', 'politics', 'tech', 'entertainment', 'weather'];
      const randomCat = categories[Math.floor(Math.random() * categories.length)];

      await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.ADMIN_SECRET!,
        },
        body: JSON.stringify({
          region: 'turkey',
          category: randomCat,
          count: Math.min(resolvedCount, 3),
        }),
      });
    } catch {
      // Non-critical — don't fail the whole cron if generation fails
    }
  }

  return Response.json({
    resolved: resolvedCount,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  });
}
