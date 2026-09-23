import { hasAdminSecret, unauthorized } from '@/lib/adminAuth';
import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateOdds, calculatePayout } from '@/lib/odds';
import { personaOf, affinity, commentPrompt, fallbackComment, sanitizeComment } from '@/lib/botVoice';
import { chat, llmProvider } from '@/lib/llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** İki tick arası en az bu kadar dakika geçmeli (sayfa ziyaretleriyle + harici ping ile tetiklenir). */
const THROTTLE_MINUTES = 5;
/** Gece 02:00–07:00 TRT arası botlar da uyur — gerçekçi ritim. */
const QUIET_HOURS_TRT: [number, number] = [2, 7];

/** Bot + market ikilisi için sabit bir "kanaat": aynı bot aynı markette tutarlı davranır. */
function conviction(botId: string, marketId: string): number {
  let h = 0;
  const s = botId + marketId;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000; // 0..1
}

type Bot = { id: string; username: string; balance: number; total_bets: number | null };
type MarketRow = {
  id: string; title_tr: string; description_tr: string | null; category: string; ends_at: string;
  yes_pool: number; no_pool: number; total_volume: number; participant_count: number;
};

/**
 * Atomik bahis (migration-10 `bot_place_bet`). Fonksiyon yoksa eski okuma-yazma yoluna düşer.
 * Eski yol havuzları okuyup üzerine yazdığı için eşzamanlı kullanıcı bahsini ezebilir — migration'ı uygula.
 */
async function placeBotBet(supabase: SupabaseClient, bot: Bot, market: MarketRow, side: 'yes' | 'no', amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('bot_place_bet', {
    p_user_id: bot.id, p_market_id: market.id, p_side: side, p_amount: amount,
  });
  if (!error) return (data as { yes_prob: number }).yes_prob;
  if (!/bot_place_bet|function|schema cache/i.test(error.message)) throw new Error(error.message);

  if (bot.balance < amount) {
    await supabase.from('profiles').update({ balance: bot.balance + 100_000 }).eq('id', bot.id);
    bot.balance += 100_000;
  }
  const { yesProb, noProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
  const newYesPool = market.yes_pool + (side === 'yes' ? amount : 0);
  const newNoPool = market.no_pool + (side === 'no' ? amount : 0);
  const newYesProb = newYesPool / (newYesPool + newNoPool);
  await supabase.from('bets').insert({
    user_id: bot.id, market_id: market.id, side, amount,
    odds_at_bet: side === 'yes' ? yesOdds : noOdds,
    potential_payout: calculatePayout(amount, side === 'yes' ? yesProb : noProb),
    status: 'pending',
  });
  await supabase.from('markets').update({
    yes_pool: newYesPool, no_pool: newNoPool, yes_prob: newYesProb,
    total_volume: market.total_volume + amount, participant_count: market.participant_count + 1,
  }).eq('id', market.id);
  await supabase.from('market_prob_history').insert({ market_id: market.id, yes_prob: newYesProb });
  await supabase.from('profiles').update({ balance: bot.balance - amount, total_bets: (bot.total_bets ?? 0) + 1 }).eq('id', bot.id);
  bot.balance -= amount;
  return newYesProb;
}

export async function GET(req: Request) {
  if (!(await hasAdminSecret())) return unauthorized();

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const burst = Math.min(parseInt(url.searchParams.get('burst') ?? '0') || 0, 40);
  const supabase = await createAdminClient();

  const hourTrt = (new Date().getUTCHours() + 3) % 24;
  if (!force && hourTrt >= QUIET_HOURS_TRT[0] && hourTrt < QUIET_HOURS_TRT[1]) {
    return Response.json({ skipped: true, reason: 'quiet_hours' });
  }

  if (!force) {
    const { data: lastBet } = await supabase
      .from('bets')
      .select('created_at, profiles!inner(is_bot)')
      .eq('profiles.is_bot', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastBet && Date.now() - new Date(lastBet.created_at).getTime() < THROTTLE_MINUTES * 60_000) {
      return Response.json({ skipped: true, reason: 'throttled' });
    }
  }

  const nowIso = new Date().toISOString();
  const [{ data: botRows }, { data: marketRows }, { data: recent }] = await Promise.all([
    supabase.from('profiles').select('id, username, balance, total_bets').eq('is_bot', true),
    supabase.from('markets')
      .select('id, title_tr, description_tr, category, ends_at, yes_pool, no_pool, total_volume, participant_count')
      .eq('status', 'active').eq('kind', 'binary').gt('ends_at', nowIso),
    // Son 24 saatte hangi marketlere bahis geldi → az ilgi görenlere öncelik
    supabase.from('bets').select('market_id').gte('created_at', new Date(Date.now() - 864e5).toISOString()),
  ]);
  const bots = (botRows ?? []) as Bot[];
  const markets = (marketRows ?? []) as MarketRow[];

  if (!bots.length || !markets.length) {
    return Response.json({ skipped: true, reason: !bots.length ? 'no_bots' : 'no_markets' });
  }

  const recentCount = new Map<string, number>();
  for (const b of recent ?? []) recentCount.set(b.market_id, (recentCount.get(b.market_id) ?? 0) + 1);

  // Ağırlıklı seçim: az bahis alan + yakında kapanacak marketler öne çıkar
  const weighted = markets.map((m) => {
    const daysLeft = Math.max(1, (new Date(m.ends_at).getTime() - Date.now()) / 864e5);
    const w = 1 / (1 + (recentCount.get(m.id) ?? 0)) + (daysLeft <= 7 ? 0.8 : 0) + (m.total_volume < 20_000 ? 0.5 : 0);
    return { m, w };
  });
  const pickWeighted = <T,>(items: { x: T; w: number }[]): T => {
    const total = items.reduce((s, i) => s + i.w, 0);
    let r = Math.random() * total;
    for (const i of items) { r -= i.w; if (r <= 0) return i.x; }
    return items[items.length - 1].x;
  };
  const pickMarket = () => pickWeighted(weighted.map(({ m, w }) => ({ x: m, w })));
  // Bot seçimi: kategoriyle ilgilenen persona daha sık gelir (futbolda TaraftarTarik, kriptoda KriptoKaan...)
  const pickBot = (category: string) => pickWeighted(bots.map((b) => ({ x: b, w: affinity(personaOf(b.username), category) })));

  const count = burst > 0 ? burst : 4 + Math.floor(Math.random() * 5); // normal tick: 4-8 bahis
  const actions: { bot: Bot; market: MarketRow; side: 'yes' | 'no'; amount: number; yes_pct: number }[] = [];
  const errors: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    let market = pickMarket();
    for (let tries = 0; burst === 0 && used.has(market.id) && tries < 5; tries++) market = pickMarket();
    used.add(market.id);
    const bot = pickBot(market.category);
    const persona = personaOf(bot.username);
    let amount = persona.stake[0] + Math.floor(Math.random() * (persona.stake[1] - persona.stake[0]));
    if (Math.random() < 0.15) amount *= 2 + Math.floor(Math.random() * 2); // balina hamlesi: oranı oynatır

    const favoriteSide = market.yes_pool >= market.no_pool ? 'yes' : 'no';
    // Kanaat + kişilik: contrarian botlar zayıf tarafı daha sık oynar; aynı bot aynı markette kararlı
    const goContrarian = conviction(bot.id, market.id) < persona.contrarian;
    const side = goContrarian ? (favoriteSide === 'yes' ? 'no' : 'yes') : favoriteSide;

    try {
      const newYesProb = await placeBotBet(supabase, bot, market, side, amount);
      // Yerel kopyayı güncelle ki aynı tick'teki sonraki bahisler güncel havuzu görsün
      if (side === 'yes') market.yes_pool += amount; else market.no_pool += amount;
      market.total_volume += amount; market.participant_count += 1;
      bot.total_bets = (bot.total_bets ?? 0) + 1;
      actions.push({ bot, market, side, amount, yes_pct: Math.round(newYesProb * 100) });
    } catch (e) {
      errors.push(`${bot.username}: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  // Yorum: her bahse değil — personanın konuşkanlığına göre. Konu olayın kendisi, oran değil.
  const comments: string[] = [];
  const hasLlm = llmProvider() !== null;
  const talkers = actions.filter((a) => Math.random() < personaOf(a.bot.username).chattiness);
  const targets = burst > 0 ? talkers.slice(0, 6) : talkers; // burst'te maliyet/süre sınırı
  await Promise.all(targets.map(async ({ bot, market, side, yes_pct }) => {
    try {
      const persona = personaOf(bot.username);
      const { data: recentRows } = await supabase
        .from('comments').select('content, profiles(username)').eq('market_id', market.id)
        .order('created_at', { ascending: false }).limit(6);
      const recentList = ((recentRows ?? []) as unknown as { content: string; profiles: { username: string } | { username: string }[] | null }[])
        .map((r) => ({ user: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.username ?? 'biri', text: r.content }));
      const recentTexts = recentList.map((r) => r.text);

      let text = '';
      if (hasLlm) {
        try {
          text = sanitizeComment(await chat(commentPrompt({
            bot: bot.username, persona,
            title: market.title_tr, description: market.description_tr, category: market.category, side,
            yesPct: Math.random() < persona.oddsTalk ? yes_pct : undefined,
            recent: recentList,
          }), { maxTokens: 150, temperature: 1 }));
        } catch (e) { errors.push(`llm: ${(e as Error).message.slice(0, 120)}`); }
      }
      for (let tries = 0; tries < 4 && (!text || recentTexts.includes(text)); tries++) {
        text = fallbackComment(bot.username, side, market.title_tr);
      }
      if (text && !recentTexts.includes(text)) {
        await supabase.from('comments').insert({ market_id: market.id, user_id: bot.id, content: text.slice(0, 1000) });
        comments.push(`${bot.username}: ${text}`);
      }
    } catch { /* tek yorum patlarsa diğerleri devam */ }
  }));

  return Response.json({
    bets_placed: actions.length,
    actions: actions.map((a) => ({ bot: a.bot.username, market: a.market.title_tr, side: a.side, amount: a.amount, yes_pct: a.yes_pct })),
    comments,
    llm: llmProvider() ?? 'fallback',
    research: process.env.SERPER_API_KEY ? 'serper' : (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'),
    errors: errors.length ? errors : undefined,
  });
}
