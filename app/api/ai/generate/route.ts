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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `
        Generate ${count} prediction market questions for AçıkBazaar, a free simulation platform (no real money).
        Region: ${region} | Category: ${category}
        Current date: ${new Date().toISOString()}

        Category guide:
        - politics: Elections, government decisions, geopolitical outcomes
        - economy: Interest rates, exchange rates, inflation, stock indices (TCMB, Fed, BIST, TL/USD)
        - sports: Football, basketball, F1 — Turkish leagues and international (Süper Lig, Fenerbahçe, Galatasaray)
        - tech: AI releases, crypto prices, startup milestones (OpenAI, Bitcoin, Turkish unicorns)
        - world: International events outside Turkey's domestic scope
        - entertainment: Music, film, TV — especially Turkish pop culture (Tarkan, dizi, Emmy, Cannes)
        - weather: Extreme weather events, seasonal records (Istanbul flooding, heatwaves, snowfall)

        Rules:
        - Binary YES/NO questions only
        - Verifiable with public, official sources
        - Resolves within 1–8 months from today
        - Titles must be concise and punchy (max 12 words)
        - initial_yes_prob: realistic probability between 0.05 and 0.95
        - simulated_volume: realistic total credits wagered (500–500000 depending on topic popularity)
        - tag: one of "hot", "trending", "🔥", or null — use sparingly (max 1 per batch)

        Return ONLY a JSON array, no markdown:
        [
          {
            "title_en": "Will X happen before Y?",
            "title_tr": "X, Y tarihinden önce olur mu?",
            "description_en": "Brief verifiable context (1-2 sentences)",
            "description_tr": "Kısa doğrulanabilir açıklama",
            "category": "${category}",
            "region": "${region}",
            "initial_yes_prob": 0.45,
            "simulated_volume": 45000,
            "ends_at": "2025-10-31",
            "tag": null
          }
        ]
      `,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

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
