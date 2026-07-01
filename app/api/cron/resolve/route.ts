import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

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

  // Find all active markets that have passed their end date
  const { data: expiredMarkets, error: fetchError } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'active')
    .lt('ends_at', new Date().toISOString());

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expiredMarkets || expiredMarkets.length === 0) {
    return Response.json({ message: 'No expired markets', resolved: 0 });
  }

  const results = [];

  for (const market of expiredMarkets) {
    try {
      // Ask Claude to research and determine the outcome
      const response = await client.beta.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `You are resolving a binary prediction market. Research whether this event occurred.

Question (EN): ${market.title_en}
Question (TR): ${market.title_tr}
${market.description_en ? `Resolution criteria: ${market.description_en}` : ''}
Market end date: ${market.ends_at}
Today: ${new Date().toISOString()}

Search for recent news and facts, then respond with ONLY a JSON object (no other text):
{"outcome": true, "confidence": 0.9, "reasoning": "One sentence explanation with source"}

Rules:
- outcome: true = YES happened, false = NO / did not happen
- confidence: 0.0–1.0 (how sure you are based on search results)
- If you cannot determine with confidence >= 0.7, set outcome to null`,
        }],
      });

      // Extract the final text response (after any tool calls)
      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        results.push({ market_id: market.id, status: 'skipped', reason: 'No text from Claude' });
        continue;
      }

      let verdict: { outcome: boolean | null; confidence: number; reasoning: string };
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*?\}/);
        verdict = JSON.parse(jsonMatch?.[0] ?? '{}');
      } catch {
        results.push({ market_id: market.id, status: 'error', reason: 'JSON parse failed', raw: textContent.text });
        continue;
      }

      // Skip if Claude is not confident enough
      if (verdict.outcome === null || verdict.outcome === undefined || verdict.confidence < 0.7) {
        results.push({ market_id: market.id, status: 'skipped', reason: `Low confidence: ${verdict.confidence}`, reasoning: verdict.reasoning });
        continue;
      }

      // Mark market as resolved
      await supabase.from('markets').update({
        status: 'resolved',
        outcome: verdict.outcome,
        resolved_at: new Date().toISOString(),
      }).eq('id', market.id);

      // Fetch all pending bets on this market
      const { data: bets } = await supabase
        .from('bets')
        .select('*')
        .eq('market_id', market.id)
        .eq('status', 'pending');

      let winners = 0;
      let losers = 0;

      for (const bet of bets ?? []) {
        const won =
          (bet.side === 'yes' && verdict.outcome === true) ||
          (bet.side === 'no'  && verdict.outcome === false);

        const settled_at = new Date().toISOString();
        if (won) {
          await supabase.from('bets').update({ status: 'won', settled_at }).eq('id', bet.id);
          // Credit winnings to user balance
          await supabase.rpc('credit_and_update_user', {
            p_user_id: bet.user_id,
            p_amount: bet.potential_payout,
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
        outcome: verdict.outcome,
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
