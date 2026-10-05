import type { SupabaseClient } from '@supabase/supabase-js';
import { personaOf, affinity, strategyOf, isActiveAt, commentPrompt, fallbackComment, sanitizeComment, type BotPersona } from '@/lib/botVoice';
import { chat, llmProvider } from '@/lib/llm';
import { clamp, hourTrt, type Agent } from '../core';

/**
 * Bot ajanları (ucuz mod: karar formülle, LLM sadece yorumda). Her bot:
 *  - ritim: yalnızca personasının aktif saatlerinde oynar (persona.active)
 *  - inanç: tracker'ın haber tahminini kendi kişiliğiyle bozar; kalabalık inancından uzaksa o tarafa oynar
 *  - kasa: tutar = bakiye × betFraction × fark × ruh hali; aynı markete haftada en fazla maxPerMarketWeek bahis
 *  - hafıza: son çözülen bahislerinden seri çıkarır; tilt > 0 kayıp kovalar, < 0 temkinlileşir;
 *    seri yoruma da bağlam olarak girer ("üst üste tutmadı")
 */
const BETS_MIN = parseInt(process.env.TRADER_BETS_MIN ?? '2');
const BETS_MAX = parseInt(process.env.TRADER_BETS_MAX ?? '6');

type Bot = { id: string; username: string; balance: number };
type Market = {
  id: string; title_tr: string; description_tr: string | null; category: string; ends_at: string;
  yes_pool: number; no_pool: number; total_volume: number;
};
type Estimate = { yes_prob: number; confidence: number; summary_tr: string | null };
type Memory = { streak: number; wins: number; losses: number };

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

/** Son 10 çözülen bahisten seri: +3 = üst üste 3 kazanç, -2 = üst üste 2 kayıp. */
async function loadMemory(db: SupabaseClient, botId: string): Promise<Memory> {
  const { data } = await db.from('bets').select('status').eq('user_id', botId).in('status', ['won', 'lost'])
    .order('settled_at', { ascending: false }).limit(10);
  const results = (data ?? []).map((b) => b.status as 'won' | 'lost');
  let streak = 0;
  for (const r of results) {
    if (streak === 0) streak = r === 'won' ? 1 : -1;
    else if ((streak > 0) === (r === 'won')) streak += streak > 0 ? 1 : -1;
    else break;
  }
  return { streak, wins: results.filter((r) => r === 'won').length, losses: results.filter((r) => r === 'lost').length };
}

function memoryLine(mem: Memory): string | null {
  if (mem.streak <= -2) return `Senin son durumun: üst üste ${-mem.streak} tahminin tutmadı (istersen buna değin).`;
  if (mem.streak >= 2) return `Senin son durumun: son ${mem.streak} tahminin tuttu, havadasın (istersen buna değin).`;
  return null;
}

/** Tutar: bakiye × kasa oranı, farkla ölçeklenir, seri ve tilt ile oynar; persona aralığında kalır. */
function stakeFor(bot: Bot, persona: BotPersona, edge: number, mem: Memory): number {
  const { betFraction, tilt } = strategyOf(persona);
  const bankroll = Math.max(bot.balance, persona.stake[0] * 4);
  const edgeMult = clamp(0.6 + edge * 4, 0.6, 2.5);
  const mood = mem.streak < 0 ? 1 + tilt * Math.min(-mem.streak, 4) * 0.15 : 1 + Math.min(mem.streak, 4) * 0.05;
  const jitter = 0.8 + Math.random() * 0.4;
  const raw = bankroll * betFraction * edgeMult * clamp(mood, 0.4, 1.8) * jitter;
  return Math.round(clamp(raw, persona.stake[0] * 0.5, persona.stake[1] * 1.5));
}

async function comment(db: SupabaseClient, bot: Bot, m: Market, side: 'yes' | 'no', est: Estimate | undefined, mem: Memory, yesPct: number, useLlm: boolean): Promise<string | null> {
  const persona = personaOf(bot.username);
  const { data: rows } = await db.from('comments').select('content, profiles(username)').eq('market_id', m.id)
    .order('created_at', { ascending: false }).limit(6);
  const recent = ((rows ?? []) as unknown as { content: string; profiles: { username: string } | { username: string }[] | null }[])
    .map((r) => ({ user: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.username ?? 'biri', text: r.content }));
  const recentTexts = recent.map((r) => r.text);

  const description = [
    m.description_tr,
    est?.summary_tr ? `Son gelişme (haberlerden): ${est.summary_tr}` : null,
    memoryLine(mem),
  ].filter(Boolean).join('\n');
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
  // Genel sessizlik sadece sabaha karşı; gece kuşu botlar (Ozan, Kaan) 03:00'e kadar kendi saatlerinde oynar
  quietHoursTrt: [4, 7],
  onOverBudget: 'degrade',
  async run(db, ctx) {
    const nowIso = new Date().toISOString();
    const hour = hourTrt();
    const [{ data: botRows }, { data: marketRows }, { data: recentBets }, { data: estRows }] = await Promise.all([
      db.from('profiles').select('id, username, balance').eq('is_bot', true),
      db.from('markets').select('id, title_tr, description_tr, category, ends_at, yes_pool, no_pool, total_volume')
        .eq('status', 'active').eq('kind', 'binary').gt('ends_at', nowIso),
      db.from('bets').select('market_id').gte('created_at', new Date(Date.now() - 864e5).toISOString()).limit(5000),
      db.from('market_estimates').select('market_id, yes_prob, confidence, summary_tr, created_at')
        .gte('created_at', new Date(Date.now() - 3 * 864e5).toISOString()).order('created_at', { ascending: false }),
    ]);
    const allBots = (botRows ?? []) as Bot[];
    const awake = allBots.filter((b) => isActiveAt(personaOf(b.username), hour));
    const markets = (marketRows ?? []) as Market[];
    if (!awake.length || !markets.length) return { skipped: !awake.length ? 'no_bot_awake' : 'no_markets', hour };

    const estimates = new Map<string, Estimate>();
    for (const e of estRows ?? []) if (!estimates.has(e.market_id)) estimates.set(e.market_id, e as Estimate);
    const recentCount = new Map<string, number>();
    for (const b of recentBets ?? []) recentCount.set(b.market_id, (recentCount.get(b.market_id) ?? 0) + 1);

    // Uyanık bot oranı kadar tempo: gece 2 bot uyanıksa az bahis
    const base = BETS_MIN + Math.floor(Math.random() * (BETS_MAX - BETS_MIN + 1));
    const count = Math.max(1, Math.round(base * Math.min(1, awake.length / Math.max(1, allBots.length) + 0.3)));

    const memories = new Map<string, Memory>();
    const used = new Set<string>();
    const bets: { bot: string; market: string; side: string; amount: number; edge: number; streak: number; informed: boolean }[] = [];
    const comments: string[] = [];
    const errors: string[] = [];
    let capped = 0;

    for (let i = 0; i < count; i++) {
      const bot = pickWeighted(awake.map((b) => ({ x: b, w: 1 })));
      const persona = personaOf(bot.username);
      const { maxPerMarketWeek } = strategyOf(persona);

      // Botun ilgi alanı + az ilgi gören + yakında kapanan + haberi taze marketler öne çıkar
      const weighted = markets.filter((m) => !used.has(m.id)).map((m) => {
        const daysLeft = Math.max(1, (new Date(m.ends_at).getTime() - Date.now()) / 864e5);
        const w = (1 / (1 + (recentCount.get(m.id) ?? 0)) + (daysLeft <= 7 ? 0.8 : 0) + (m.total_volume < 20_000 ? 0.5 : 0) + (estimates.has(m.id) ? 0.4 : 0))
          * affinity(persona, m.category);
        return { x: m, w };
      });
      if (!weighted.length) break;

      // Kasa kuralı: bu markete bu hafta yeterince oynadıysa başka market dene
      let m: Market | null = null;
      for (let t = 0; t < 4 && !m; t++) {
        const cand = pickWeighted(weighted);
        const { count: weekCount } = await db.from('bets').select('id', { count: 'exact', head: true })
          .eq('user_id', bot.id).eq('market_id', cand.id).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString());
        if ((weekCount ?? 0) < maxPerMarketWeek) m = cand; else capped++;
      }
      if (!m) continue;
      used.add(m.id);

      const est = estimates.get(m.id);
      const { side, edge } = decide(bot, persona, m, est);
      // Fark yoksa çoğu zaman pas geç — botlar her şeye oynamaz
      if (est && edge < 0.03 && Math.random() < 0.6) continue;

      if (!memories.has(bot.id)) memories.set(bot.id, await loadMemory(db, bot.id));
      const mem = memories.get(bot.id)!;
      const amount = stakeFor(bot, persona, edge, mem);

      const { data, error } = await db.rpc('bot_place_bet', { p_user_id: bot.id, p_market_id: m.id, p_side: side, p_amount: amount });
      if (error) { errors.push(`${bot.username}: ${error.message.slice(0, 100)}`); continue; }

      const yesProb = (data as { yes_prob: number }).yes_prob;
      if (side === 'yes') m.yes_pool += amount; else m.no_pool += amount;
      m.total_volume += amount;
      bot.balance = Math.max(0, bot.balance - amount);
      bets.push({ bot: bot.username, market: m.title_tr.slice(0, 70), side, amount, edge: Math.round(edge * 100) / 100, streak: mem.streak, informed: !!est });

      if (Math.random() < persona.chattiness) {
        const text = await comment(db, bot, m, side, est, mem, Math.round(yesProb * 100), !ctx.overBudget);
        if (text) comments.push(`${bot.username}: ${text}`);
      }
    }

    if (count > 0 && !bets.length && errors.length) throw new Error(`no bets placed: ${errors[0]}`);
    return {
      hour, awake: awake.map((b) => b.username), bets: bets.length, informed: bets.filter((b) => b.informed).length,
      capped, comments: comments.length, detail: bets, sampleComments: comments.slice(0, 3), errors,
    };
  },
};
