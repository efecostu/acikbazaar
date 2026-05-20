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
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `
        Generate ${count} prediction market questions for AçıkBazaar, a free simulation platform.
        Region: ${region} | Category: ${category}
        Current date: ${new Date().toISOString()}

        Rules:
        - Binary YES/NO questions only
        - Resolves within 1-6 months
        - Verifiable with public data
        - Turkey focus: TCMB, TL/USD, Süper Lig, Turkish politics, BIST
        - Global focus: Fed, crypto, AI companies, elections

        Return ONLY a JSON array, no markdown:
        [
          {
            "title_en": "Will X happen before Y?",
            "title_tr": "X, Y tarihinden önce olur mu?",
            "description_en": "Brief context",
            "description_tr": "Kısa açıklama",
            "category": "economy",
            "region": "turkey",
            "initial_yes_prob": 0.45,
            "ends_at": "2025-09-30",
            "tag": "hot"
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
    markets.map((m) => ({
      title_en: m.title_en,
      title_tr: m.title_tr,
      description_en: m.description_en,
      description_tr: m.description_tr,
      category: m.category,
      region: m.region,
      yes_prob: m.initial_yes_prob,
      yes_pool: 0,
      no_pool: 0,
      total_volume: 0,
      participant_count: 0,
      ends_at: m.ends_at,
      tag: m.tag,
    }))
  ).select();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, markets: data });
}
