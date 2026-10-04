import type { SupabaseClient } from '@supabase/supabase-js';
import { personaOf, affinity, commentPrompt, fallbackComment, sanitizeComment, type BotPersona } from '@/lib/botVoice';
import { chat, llmProvider } from '@/lib/llm';
import { clamp, type Agent } from '../core';

/**
 * AI botların bahisleri. Her bot, tracker'ın haber tabanlı tahminini kendi kişiliğiyle
 * bozarak bir "inanç" oluşturur; kalabalık olasılığı inancından uzaksa o tarafa oynar,
 * fark büyüdükçe tutarı büyütür. Tahmin yoksa eski kanaat/kontrarian mantığına düşer.
 * Yorumlarda tracker'ın haber özeti bağlam olarak verilir (oran değil, olay konuşulur).
 */
const BETS_MIN = parseInt(process.env.TRADER_BETS_MIN ?? '2');
const BETS_MAX = parseInt(process.env.TRADER_BETS_MAX ?? '6');

type Bot = { id: string; username: string };
type Market = {
  id: string; title_tr: string; description_tr: string | null; category: string; ends_at: string;
  yes_pool: number; no_pool: number; total_volume: number;
};
type Estimate = { yes_prob: number; confidence: number; summary_tr: string | null };

/** Bot + market için sabit sayı (0..1): aynı bot aynı markette tutarlı davranır. */
function seeded(botId: string, marketId: string): number {
  let h = 0;
  const s = botId + marketId;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function pickWeighted<T>(items: { x: T; w: number }[]): T {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const i of items) { r -= i.w; if (r <= 0) return i.x; }
  return items[items.length - 1].x;
}

function decide(bot: Bot, persona: BotPersona, m: Market, est: Estimate | undefined): { side: 'yes' | 'no'; edge: number } {
  const crowd = m.yes_pool + m.no_pool > 0 ? m.yes_pool / (m.yes_pool + m.no_pool) : 0.5;
  const s = seeded(bot.id, m.id);
  if (!est) {
    const favorite = crowd >= 0.5 ? 'yes' : 'no';
    const contrarian = s < persona.contrarian;
    return { side: contrarian ? (favorite === 'yes' ? 'no' : 'yes') : favorite, edge: 0.05 };
  }
  // Kişisel sapma: düşük güvenli tahminde botlar daha çok ayrışır; kontrarian botlar kalabalığa ters eğilir
  const spread = 0.06 + (1 - Number(est.confidence)) * 0.18;
  const personal = (s - 0.5) * 2 * spread;
  const contra = (persona.contrarian - 0.3) * (0.5 - crowd) * 0.6;
  const belief = clamp(Number(est.yes_prob) + personal + contra, 0.02, 0.98);
  return { side: belief >= crowd ? 'yes' : 'no', edge: Math.abs(belief - crowd) };
}

async function comment(db: SupabaseClient, bot: Bot, m: Market, side: 'yes' | 'no', est: Estimate | undefined, yesPct: number, useLlm: boolean): Promise<string | null> {
  const persona = personaOf(bot.username);
  const { data: rows } = await db.from('comments').select('content, profiles(username)').eq('market_id', m.id)
    .order('created_at', { ascending: false }).limit(6);
  const recent = ((rows ?? []) as unknown as { content: string; profiles: { username: string } | { username: string }[] | null }[])
    .map((r) => ({ user: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.username ?? 'biri', text: r.content }));
  const recentTexts = recent.map((r) => r.text);

  const description = [m.description_tr, est?.summary_tr ? `Son gelişme (haberlerden): ${est.summary_tr}` : null].filter(Boolean).join('\n');
  let text = '';
  if (useLlm && llmProvider()) {
    try {
      text = sanitizeComment(await chat(commentPrompt({
        bot: bot.username, persona, title: m.title_tr, description, category: m.category, side,
        yesPct: Math.random() < persona.oddsTalk ? yesPct : undefined, recent,
      }), { maxTokens: 150, temperature: 1 }));
    } catch { /* şablona düş */ }
  }
  for (let tries = 0; tries < 4 && (!text || recentTexts.includes(text)); tries++) text = fallbackComment(bot.username, side, m.title_tr);
  if (!text || recentTexts.includes(text)) return null;
  const { error } = await db.from('comments').insert({ market_id: m.id, user_id: bot.id, content: text.slice(0, 1000) });
  return error ? null : text;
}

export const trader: Agent = {
  name: 'trader',
  everyMin: 12,
  quietHoursTrt: [2, 7],
  onOverBudget: 'degrade',
  async run(db, ctx) {
    const nowIso = new Date().toISOString();
    const [{ data: botRows }, { data: marketRows }, { data: recentBets }, { data: estRows }] = await Promise.all([
      db.from('profiles').select('id, username').eq('is_bot', true),
      db.from('markets').select('id, title_tr, description_tr, category, ends_at, yes_pool, no_pool, total_volume')
        .eq('status', 'active').eq('kind', 'binary').gt('ends_at', nowIso),
      db.from('bets').select('market_id').gte('created_at', new Date(Date.now() - 864e5).toISOString()),
      db.from('market_estimates').select('market_id, yes_prob, confidence, summary_tr, created_at')
        .gte('created_at', new Date(Date.now() - 3 * 864e5).toISOString()).order('created_at', { ascending: false }),
    ]);
    const bots = (botRows ?? []) as Bot[];
    const markets = (marketRows ?? []) as Market[];
    if (!bots.length || !markets.length) return { skipped: !bots.length ? 'no_bots' : 'no_markets' };

    const estimates = new Map<string, Estimate>();
    for (const e of estRows ?? []) if (!estimates.has(e.market_id)) estimates.set(e.market_id, e as Estimate);
    const recentCount = new Map<string, number>();
    for (const b of recentBets ?? []) recentCount.set(b.market_id, (recentCount.get(b.market_id) ?? 0) + 1);

    // Az ilgi gören, yakında kapanan ve haberi taze olan marketler öne çıkar
    const weighted = markets.map((m) => {
      const daysLeft = Math.max(1, (new Date(m.ends_at).getTime() - Date.now()) / 864e5);
      const w = 1 / (1 + (recentCount.get(m.id) ?? 0)) + (daysLeft <= 7 ? 0.8 : 0) + (m.total_volume < 20_000 ? 0.5 : 0) + (estimates.has(m.id) ? 0.4 : 0);
      return { x: m, w };
    });

    const count = BETS_MIN + Math.floor(Math.random() * (BETS_MAX - BETS_MIN + 1));
    const used = new Set<string>();
    const bets: { bot: string; market: string; side: string; amount: number; edge: number; informed: boolean }[] = [];
    const comments: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      let m = pickWeighted(weighted);
      for (let t = 0; used.has(m.id) && t < 5; t++) m = pickWeighted(weighted);
      used.add(m.id);
      const bot = pickWeighted(bots.map((b) => ({ x: b, w: affinity(personaOf(b.username), m.category) })));
      const persona = personaOf(bot.username);
      const est = estimates.get(m.id);
      const { side, edge } = decide(bot, persona, m, est);

      // Fark yoksa çoğu zaman pas geç — botlar her şeye oynamaz
      if (est && edge < 0.03 && Math.random() < 0.6) continue;

      const base = persona.stake[0] + Math.random() * (persona.stake[1] - persona.stake[0]);
      const amount = Math.round(base * clamp(0.6 + edge * 4, 0.6, 2.5));
      const { data, error } = await db.rpc('bot_place_bet', { p_user_id: bot.id, p_market_id: m.id, p_side: side, p_amount: amount });
      if (error) { errors.push(`${bot.username}: ${error.message.slice(0, 100)}`); continue; }

      const yesProb = (data as { yes_prob: number }).yes_prob;
      if (side === 'yes') m.yes_pool += amount; else m.no_pool += amount;
      m.total_volume += amount;
      bets.push({ bot: bot.username, market: m.title_tr.slice(0, 70), side, amount, edge: Math.round(edge * 100) / 100, informed: !!est });

      if (Math.random() < persona.chattiness) {
        const text = await comment(db, bot, m, side, est, Math.round(yesProb * 100), !ctx.overBudget);
        if (text) comments.push(`${bot.username}: ${text}`);
      }
    }

    if (count > 0 && !bets.length && errors.length) throw new Error(`no bets placed: ${errors[0]}`);
    return { bets: bets.length, informed: bets.filter((b) => b.informed).length, comments: comments.length, detail: bets, sampleComments: comments.slice(0, 3), errors };
  },
};
