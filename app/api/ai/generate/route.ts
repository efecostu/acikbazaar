import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

const client = new Anthropic();

export async function POST(req: Request) {
  const headerStore = await headers();
  const adminSecret = headerStore.get('x-admin-secret');

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { region = 'turkey', category = 'economy', count = 3 } = await req.json();

  const today = new Date().toISOString().slice(0, 10);

  // Use web search so Claude knows what's actually happening right now
  const response = await client.beta.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    betas: ['web-search-2025-03-05'],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Today is ${today}. You are generating prediction markets for AçıkBazaar (free simulation, no real money).

STEP 1 — Search the web for recent news in: category="${category}", region="${region}".
Find events that are UPCOMING or IN PROGRESS — things that have NOT been decided yet.
Specifically avoid anything that already has a known result as of today.

STEP 2 — Generate ${count} binary YES/NO prediction market(s) based on what you found.

Category guide:
- politics: Elections, government decisions, geopolitical outcomes
- economy: Interest rates, FX rates, inflation, indices (TCMB, Fed, BIST, USD/TRY)
- sports: Turkish & international — upcoming matches, season outcomes, transfers
- tech: AI model releases, crypto prices, startup news
- world: International events outside Turkey
- entertainment: Music, film, TV — Turkish pop culture & international
- weather: Extreme weather forecasts, seasonal records

Rules:
- ONLY events that have NOT happened yet as of ${today}
- Resolves within 1–8 months from today (ends_at must be > ${today})
- Binary YES/NO, verifiable with public sources
- Punchy titles, max 12 words
- initial_yes_prob: realistic 0.05–0.95 based on current odds/sentiment
- simulated_volume: 500–500000 depending on topic popularity
- tag: "hot", "trending", "🔥", or null (max 1 per batch)

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "title_en": "Will X happen before Y?",
    "title_tr": "X, Y tarihinden önce olur mu?",
    "description_en": "Brief verifiable resolution criteria (1-2 sentences)",
    "description_tr": "Kısa doğrulanabilir açıklama",
    "category": "${category}",
    "region": "${region}",
    "initial_yes_prob": 0.55,
    "simulated_volume": 35000,
    "ends_at": "2026-09-30",
    "tag": null
  }
]`,
    }],
  });

  // Extract the final text block (after tool calls)
  const textBlock = response.content.findLast((c) => c.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '[]';

  let markets: Record<string, unknown>[];
  try {
    markets = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.from('markets').insert(
    markets.map((m) => {
      const prob = Number(m.initial_yes_prob) || 0.5;
      const vol  = Number(m.simulated_volume)  || 10000;
      const yes_pool = Math.floor(vol * prob);
      const no_pool  = vol - yes_pool;
      // Rough participant estimate: ~1 per 180 credits, min 10
      const participant_count = Math.max(10, Math.floor(vol / 180));
      return {
        title_en: m.title_en,
        title_tr: m.title_tr,
        description_en: m.description_en,
        description_tr: m.description_tr,
        category: m.category,
        region: m.region,
        yes_prob: prob,
        yes_pool,
        no_pool,
        total_volume: vol,
        participant_count,
        ends_at: m.ends_at,
        tag: m.tag ?? null,
      };
    })
  ).select();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, markets: data });
}
