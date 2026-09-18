import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { calculateOdds, calculatePayout } from '@/lib/odds';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Bot kişilikleri — yorum tonu + bahis stili
const PERSONAS: Record<string, { voice: string; contrarian: number; stake: [number, number] }> = {
  KahinKemal:   { voice: 'Kendine aşırı güvenen, iddialı konuşan bir amca. Hafif "ben demiştim" havası var.', contrarian: 0.25, stake: [1500, 12000] },
  BorsaKurdu:   { voice: 'Piyasa diliyle konuşan, oranlara ve rakamlara referans veren borsacı tipi.',         contrarian: 0.35, stake: [3000, 25000] },
  AnalizciAyse: { voice: 'Sakin, veri odaklı, kısa ve mantıklı analiz yapan.',                                   contrarian: 0.30, stake: [800, 7000] },
  SkeptikSelin: { voice: 'Her şeye şüpheyle yaklaşan, çoğunluğun tersini savunmayı seven.',                     contrarian: 0.65, stake: [1000, 9000] },
};

/** İki tick arası en az bu kadar dakika geçmeli (sayfa ziyaretleriyle tetiklenir). */
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

export async function GET(req: Request) {
  const headerStore = await headers();
  if (!process.env.ADMIN_SECRET || headerStore.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const [{ data: bots }, { data: markets }, { data: recent }] = await Promise.all([
    supabase.from('profiles').select('id, username, balance, total_bets').eq('is_bot', true),
    supabase.from('markets').select('*').eq('status', 'active').eq('kind', 'binary').gt('ends_at', nowIso),
    // Son 24 saatte hangi marketlere bahis geldi → az ilgi görenlere öncelik
    supabase.from('bets').select('market_id').gte('created_at', new Date(Date.now() - 864e5).toISOString()),
  ]);

  if (!bots?.length || !markets?.length) {
    return Response.json({ skipped: true, reason: !bots?.length ? 'no_bots' : 'no_markets' });
  }

  const recentCount = new Map<string, number>();
  for (const b of recent ?? []) recentCount.set(b.market_id, (recentCount.get(b.market_id) ?? 0) + 1);

  // Ağırlıklı seçim: az bahis alan + yakında kapanacak marketler öne çıkar
  const weighted = markets.map((m) => {
    const daysLeft = Math.max(1, (new Date(m.ends_at).getTime() - Date.now()) / 864e5);
    const w = 1 / (1 + (recentCount.get(m.id) ?? 0)) + (daysLeft <= 7 ? 0.8 : 0) + (m.total_volume < 20_000 ? 0.5 : 0);
    return { m, w };
  });
  const pickWeighted = () => {
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) { r -= x.w; if (r <= 0) return x.m; }
    return weighted[weighted.length - 1].m;
  };
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const count = burst > 0 ? burst : 4 + Math.floor(Math.random() * 5); // normal tick: 4-8 bahis
  const actions: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    const market = burst > 0 ? pickWeighted() : (() => { let m = pickWeighted(); let tries = 0; while (used.has(m.id) && tries++ < 5) m = pickWeighted(); return m; })();
    used.add(market.id);
    const bot = pick(bots);
    const persona = PERSONAS[bot.username] ?? { voice: '', contrarian: 0.3, stake: [200, 3000] as [number, number] };
    let amount = persona.stake[0] + Math.floor(Math.random() * (persona.stake[1] - persona.stake[0]));
    if (Math.random() < 0.15) amount *= 2 + Math.floor(Math.random() * 2); // balina hamlesi: oranı oynatır

    if (bot.balance < amount) {
      // Botların kredisi bitmesin: sessizce 100k yükle (sıralama kârı bahis sonuçlarından hesaplanır, bakiyeden değil)
      await supabase.from('profiles').update({ balance: bot.balance + 100_000 }).eq('id', bot.id);
      bot.balance += 100_000;
    }

    const favoriteSide = market.yes_pool >= market.no_pool ? 'yes' : 'no';
    const conv = conviction(bot.id, market.id);
    // Kanaat + kişilik: contrarian botlar zayıf tarafı daha sık oynar; aynı bot aynı markette kararlı
    const goContrarian = conv < persona.contrarian;
    const side = goContrarian ? (favoriteSide === 'yes' ? 'no' : 'yes') : favoriteSide;

    const { yesProb, noProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
    const prob = side === 'yes' ? yesProb : noProb;
    const odds = side === 'yes' ? yesOdds : noOdds;
    const payout = calculatePayout(amount, prob);

    const newYesPool = market.yes_pool + (side === 'yes' ? amount : 0);
    const newNoPool = market.no_pool + (side === 'no' ? amount : 0);
    const newYesProb = newYesPool / (newYesPool + newNoPool);

    await supabase.from('bets').insert({
      user_id: bot.id, market_id: market.id, side, amount,
      odds_at_bet: odds, potential_payout: payout, status: 'pending',
    });
    await supabase.from('markets').update({
      yes_pool: newYesPool, no_pool: newNoPool, yes_prob: newYesProb,
      total_volume: market.total_volume + amount,
      participant_count: market.participant_count + 1,
    }).eq('id', market.id);
    await supabase.from('market_prob_history').insert({ market_id: market.id, yes_prob: newYesProb });
    const { error: profileErr } = await supabase.from('profiles').update({
      balance: bot.balance - amount,
      total_bets: (bot.total_bets ?? 0) + 1,
    }).eq('id', bot.id);
    if (profileErr) errors.push(`${bot.username}: ${profileErr.message}`);
    bot.balance -= amount;
    bot.total_bets = (bot.total_bets ?? 0) + 1;
    market.yes_pool = newYesPool; market.no_pool = newNoPool; market.total_volume += amount; market.participant_count += 1;

    actions.push({ bot: bot.username, market: market.title_tr, side, amount, yes_pct: Math.round(newYesProb * 100) });
  }

  // ~%25 ihtimalle bir bot, bahis yaptığı markete kısa bir yorum yazar (Claude varsa)
  let commented: string | null = null;
  if (burst === 0 && Math.random() < 0.25 && process.env.ANTHROPIC_API_KEY) {
    try {
      const action = pick(actions) as { bot: string; market: string; side: string; yes_pct: number };
      const bot = bots.find((b) => b.username === action.bot)!;
      const market = markets.find((m) => m.title_tr === action.market)!;
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Sen "${action.bot}" adlı bir tahmin platformu kullanıcısısın. Kişiliğin: ${PERSONAS[action.bot]?.voice ?? ''}

Market: "${market.title_tr}"
Şu anki EVET oranı: %${action.yes_pct}
Senin pozisyonun: ${action.side === 'yes' ? 'EVET' : 'HAYIR'}

Bu markete 1-2 cümlelik kısa, doğal, günlük Türkçe bir yorum yaz. Kişiliğine uygun konuş. Hashtag ve emoji kullanma. Sadece yorumu döndür.`,
        }],
      });
      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (text) {
        await supabase.from('comments').insert({ market_id: market.id, user_id: bot.id, content: text.slice(0, 1000) });
        commented = `${action.bot}: ${text}`;
      }
    } catch { /* yorum üretilemezse tick yine başarılı */ }
  }

  return Response.json({ bets_placed: actions.length, actions, commented, errors: errors.length ? errors : undefined });
}
