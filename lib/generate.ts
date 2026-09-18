import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketCategory, MarketRegion } from '@/types';

export const CATEGORIES: MarketCategory[] = ['politics', 'economy', 'sports', 'tech', 'world', 'entertainment', 'weather'];

/** Sitede her zaman en az bu kadar açık market olsun (cron top-up hedefi). */
export const TARGET_ACTIVE_MARKETS = 16;

export type GeneratedMarket = {
  title_en: string;
  title_tr: string;
  description_en: string | null;
  description_tr: string | null;
  category: MarketCategory;
  region: MarketRegion;
  yes_prob: number;
  yes_pool: number;
  no_pool: number;
  total_volume: number;
  participant_count: number;
  ends_at: string;
  tag: string | null;
};

export type GenerateResult = {
  inserted: GeneratedMarket[];
  rejected: { title: unknown; reason: string }[];
  raw?: string;
};

function extractArray(text: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(match?.[0] ?? text);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Claude + web search ile güncel, henüz sonuçlanmamış marketler üretir ve
 * DB'ye yazar. Cron top-up, admin paneli ve /api/ai/generate bunu çağırır.
 */
export async function generateMarkets(
  admin: SupabaseClient,
  opts: { region?: MarketRegion; category?: MarketCategory; count?: number } = {},
): Promise<GenerateResult> {
  const region = opts.region ?? 'turkey';
  const category = opts.category ?? 'economy';
  const count = Math.max(1, Math.min(opts.count ?? 3, 5));

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const client = new Anthropic();

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  // Mevcut açık marketler — kopya üretimi engellemek için prompt'a eklenir
  const { data: existing } = await admin
    .from('markets')
    .select('title_tr')
    .in('status', ['active', 'closed'])
    .limit(60);
  const existingList = (existing ?? []).map((m) => `- ${m.title_tr}`).join('\n');

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

These markets ALREADY EXIST — do NOT create anything that duplicates or closely overlaps them:
${existingList || '(none)'}

Rules:
- CRITICAL: today is ${today}, the current year is ${currentYear}. Never create a market about
  a season, event or deadline from ${currentYear - 1} or earlier — those are already decided.
  If a title mentions a year, it must be ${currentYear} or later.
- ONLY events that have NOT happened yet as of ${today}. Verify against your search results.
- Resolves within 2 weeks – 8 months from today (ends_at must be > ${today}). Prefer a mix of short (2–6 weeks) and longer horizons.
- Binary YES/NO, verifiable with public sources; description must state the exact resolution criterion and source.
- Punchy titles, max 12 words. Turkish title must be natural Turkish, not a literal translation.
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
    "ends_at": "${currentYear}-12-31",
    "tag": null
  }
]`,
    }],
  });

  const textBlock = response.content.findLast((c) => c.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '[]';

  let candidates: Record<string, unknown>[];
  try {
    candidates = extractArray(text) as Record<string, unknown>[];
  } catch {
    return { inserted: [], rejected: [{ title: null, reason: 'json_parse_failed' }], raw: text.slice(0, 500) };
  }

  // Sunucu tarafı kalite kontrolü — model ne dönerse dönsün bayat market DB'ye giremez
  const now = Date.now();
  const minEnd = now + 7 * 864e5;
  const maxEnd = now + 370 * 864e5;
  const rejected: { title: unknown; reason: string }[] = [];
  const existingTitles = new Set((existing ?? []).map((m) => m.title_tr.trim().toLowerCase()));

  const valid = candidates.filter((m) => {
    const endsAt = new Date(String(m.ends_at)).getTime();
    if (!m.title_en || !m.title_tr) { rejected.push({ title: m.title_en, reason: 'missing_title' }); return false; }
    if (isNaN(endsAt) || endsAt <= minEnd || endsAt > maxEnd) { rejected.push({ title: m.title_en, reason: `bad_ends_at: ${m.ends_at}` }); return false; }
    const years = `${m.title_en} ${m.title_tr}`.match(/\b20\d{2}\b/g) ?? [];
    if (years.some((y) => parseInt(y) < currentYear)) { rejected.push({ title: m.title_en, reason: 'past_year_in_title' }); return false; }
    if (existingTitles.has(String(m.title_tr).trim().toLowerCase())) { rejected.push({ title: m.title_en, reason: 'duplicate' }); return false; }
    if (!CATEGORIES.includes(m.category as MarketCategory)) m.category = category;
    if (m.region !== 'turkey' && m.region !== 'global') m.region = region;
    return true;
  });

  if (valid.length === 0) return { inserted: [], rejected, raw: text.slice(0, 500) };

  const rows: GeneratedMarket[] = valid.map((m) => {
    const prob = Math.min(0.95, Math.max(0.05, Number(m.initial_yes_prob) || 0.5));
    const vol = Math.min(500_000, Math.max(500, Math.floor(Number(m.simulated_volume) || 10_000)));
    const yes_pool = Math.floor(vol * prob);
    return {
      title_en: String(m.title_en),
      title_tr: String(m.title_tr),
      description_en: m.description_en ? String(m.description_en) : null,
      description_tr: m.description_tr ? String(m.description_tr) : null,
      category: m.category as MarketCategory,
      region: m.region as MarketRegion,
      yes_prob: prob,
      yes_pool,
      no_pool: vol - yes_pool,
      total_volume: vol,
      participant_count: Math.max(10, Math.floor(vol / 180)),
      // Gün sonu (İstanbul) kapanış — 23:59 TRT = 20:59 UTC
      ends_at: `${String(m.ends_at).slice(0, 10)}T20:59:00Z`,
      tag: m.tag ? String(m.tag) : null,
    };
  });

  const { data, error } = await admin.from('markets').insert(rows).select();
  if (error) throw new Error(error.message);

  // Grafik için başlangıç noktası
  if (data?.length) {
    await admin.from('market_prob_history').insert(
      data.map((m) => ({ market_id: m.id, yes_prob: m.yes_prob })),
    );
  }

  return { inserted: (data as GeneratedMarket[]) ?? [], rejected };
}

/**
 * Açık market sayısını hedefe tamamlar. En az temsil edilen kategorilerden
 * başlayarak üretir. Cron sonunda ve admin panelinden çağrılır.
 */
export async function topUpMarkets(
  admin: SupabaseClient,
  target = TARGET_ACTIVE_MARKETS,
): Promise<{ before: number; generated: number; batches: { category: string; inserted: number; error?: string }[] }> {
  const { data: open } = await admin
    .from('markets')
    .select('category')
    .eq('status', 'active')
    .gt('ends_at', new Date().toISOString());

  const before = open?.length ?? 0;
  const missing = target - before;
  const batches: { category: string; inserted: number; error?: string }[] = [];
  if (missing <= 0) return { before, generated: 0, batches };

  const counts = new Map<string, number>(CATEGORIES.map((c) => [c, 0]));
  for (const m of open ?? []) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  const order = [...CATEGORIES].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0));

  let generated = 0;
  for (const category of order) {
    if (generated >= missing) break;
    const count = Math.min(3, missing - generated);
    const region: MarketRegion = category === 'world' ? 'global' : Math.random() < 0.7 ? 'turkey' : 'global';
    try {
      const res = await generateMarkets(admin, { category, region, count });
      generated += res.inserted.length;
      batches.push({ category, inserted: res.inserted.length });
    } catch (err) {
      batches.push({ category, inserted: 0, error: String(err) });
    }
  }
  return { before, generated, batches };
}
