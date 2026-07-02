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
  const currentYear = new Date().getFullYear();

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
- CRITICAL: today is ${today}, the current year is ${currentYear}. Never create a market about
  a season, event or deadline from ${currentYear - 1} or earlier — those are already decided.
  If a title mentions a year, it must be ${currentYear} or later.
- ONLY events that have NOT happened yet as of ${today}. Verify against your search results.
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

  // Sunucu tarafı kalite kontrolü — model ne dönerse dönsün bayat market DB'ye giremez
  const now = Date.now();
  const maxEnd = now + 370 * 864e5; // en fazla ~12 ay ileri
  const rejected: { title: unknown; reason: string }[] = [];
  markets = markets.filter((m) => {
    const endsAt = new Date(String(m.ends_at)).getTime();
    if (!m.title_en || !m.title_tr) {
      rejected.push({ title: m.title_en, reason: 'missing_title' }); return false;
    }
    if (isNaN(endsAt) || endsAt <= now || endsAt > maxEnd) {
      rejected.push({ title: m.title_en, reason: `bad_ends_at: ${m.ends_at}` }); return false;
    }
    // Başlıkta geçmiş yıl referansı: "2025", "2024-25" gibi sezonlar dahil
    const years = `${m.title_en} ${m.title_tr}`.match(/\b20\d{2}\b/g) ?? [];
    if (years.some((y) => parseInt(y) < currentYear)) {
      rejected.push({ title: m.title_en, reason: 'past_year_in_title' }); return false;
    }
    return true;
  });

  if (markets.length === 0) {
    return Response.json({ error: 'All generated markets failed validation', rejected }, { status: 422 });
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
  return Response.json({ success: true, markets: data, rejected });
}
