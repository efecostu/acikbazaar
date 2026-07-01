import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { calculateOdds, calculatePayout } from '@/lib/odds';

export const dynamic = 'force-dynamic';

// Bot kişilikleri — yorum üretirken ses tonunu belirler
const PERSONAS: Record<string, string> = {
  KahinKemal: 'Kendine aşırı güvenen, iddialı konuşan bir amca. Hafif "ben demiştim" havası var.',
  BorsaKurdu: 'Piyasa diliyle konuşan, oranlara ve rakamlara referans veren borsacı tipi.',
  AnalizciAyse: 'Sakin, veri odaklı, kısa ve mantıklı analiz yapan.',
  SkeptikSelin: 'Her şeye şüpheyle yaklaşan, çoğunluğun tersini savunmayı seven.',
};

const THROTTLE_MINUTES = 90;

export async function GET(req: Request) {
  const headerStore = await headers();
  if (headerStore.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get('force') === '1';
  const supabase = await createAdminClient();

  // Throttle: son bot bahsi çok yeniyse hiçbir şey yapma (trafik bazlı tetiklenir)
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

  const [{ data: bots }, { data: markets }] = await Promise.all([
    supabase.from('profiles').select('id, username, balance').eq('is_bot', true),
    supabase.from('markets').select('*').eq('status', 'active').gt('ends_at', new Date().toISOString()),
  ]);

  if (!bots?.length || !markets?.length) {
    return Response.json({ skipped: true, reason: !bots?.length ? 'no_bots' : 'no_markets' });
  }

  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const shuffled = [...markets].sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, 1 + Math.floor(Math.random() * 3)); // 1-3 market

  const actions: Record<string, unknown>[] = [];

  for (const market of targets) {
    const bot = pick(bots);
    const amount = 10 + Math.floor(Math.random() * 71); // 10-80

    // Bot bakiyesi düşükse sessizce doldur
    if (bot.balance < amount) {
      await supabase.from('profiles').update({ balance: bot.balance + 10_000 }).eq('id', bot.id);
      bot.balance += 10_000;
    }

    // %70 favori tarafı, %30 zayıf tarafı oyna — oranlar hafif dalgalanır
    const favoriteSide = market.yes_pool >= market.no_pool ? 'yes' : 'no';
    const side = Math.random() < 0.7 ? favoriteSide : favoriteSide === 'yes' ? 'no' : 'yes';

    const { yesProb, noProb, yesOdds, noOdds } = calculateOdds(market.yes_pool, market.no_pool);
    const prob = side === 'yes' ? yesProb : noProb;
    const odds = side === 'yes' ? yesOdds : noOdds;
    const payout = calculatePayout(amount, prob);

    const newYesPool = market.yes_pool + (side === 'yes' ? amount : 0);
    const newNoPool = market.no_pool + (side === 'no' ? amount : 0);

    await supabase.from('bets').insert({
      user_id: bot.id, market_id: market.id, side, amount,
      odds_at_bet: odds, potential_payout: payout, status: 'pending',
    });
    await supabase.from('markets').update({
      yes_pool: newYesPool,
      no_pool: newNoPool,
      yes_prob: newYesPool / (newYesPool + newNoPool),
      total_volume: market.total_volume + amount,
      participant_count: market.participant_count + 1,
    }).eq('id', market.id);
    await supabase.from('profiles').update({ balance: bot.balance - amount }).eq('id', bot.id);
    bot.balance -= amount;

    actions.push({ bot: bot.username, market: market.title_en, side, amount });
  }

  // ~%30 ihtimalle bir bot, bahis yaptığı markete kısa bir yorum yazar
  let commented: string | null = null;
  if (Math.random() < 0.3 && process.env.ANTHROPIC_API_KEY) {
    try {
      const action = pick(actions) as { bot: string; market: string; side: string };
      const bot = bots.find((b) => b.username === action.bot)!;
      const market = targets.find((m) => m.title_en === action.market)!;
      const yesPct = Math.round((market.yes_pool / (market.yes_pool + market.no_pool || 1)) * 100);

      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Sen "${action.bot}" adlı bir tahmin platformu kullanıcısısın. Kişiliğin: ${PERSONAS[action.bot]}

Market: "${market.title_tr}"
Şu anki EVET oranı: %${yesPct}
Senin pozisyonun: ${action.side === 'yes' ? 'EVET' : 'HAYIR'}

Bu markete 1-2 cümlelik kısa, doğal, günlük Türkçe bir yorum yaz. Kişiliğine uygun konuş. Hashtag kullanma, en fazla 1 emoji. Sadece yorumu döndür, başka hiçbir şey yazma.`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (text) {
        await supabase.from('comments').insert({
          market_id: market.id, user_id: bot.id, content: text.slice(0, 1000),
        });
        commented = `${action.bot}: ${text}`;
      }
    } catch {
      // Yorum üretilemezse tick yine başarılı sayılır
    }
  }

  return Response.json({ bets_placed: actions.length, actions, commented });
}
