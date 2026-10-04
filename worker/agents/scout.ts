import { CATEGORIES, TARGET_ACTIVE_MARKETS, generateMarkets, topUpMarkets } from '@/lib/generate';
import type { MarketCategory, MarketRegion } from '@/types';
import type { Agent } from '../core';

/**
 * Market üretimi. İki kural:
 *  1. Açık market sayısı TARGET_ACTIVE_MARKETS'ın altındaysa en az temsil edilen kategorilerden tamamla.
 *  2. Tazelik: SCOUT_FRESH_HOURS boyunca hiç yeni market açılmadıysa (ve tavan aşılmadıysa)
 *     en zayıf kategoriden 2 yeni market üret — gündem akmaya devam etsin.
 */
const TARGET = TARGET_ACTIVE_MARKETS;
const MAX_ACTIVE = parseInt(process.env.SCOUT_MAX_ACTIVE ?? '70');
const FRESH_HOURS = parseInt(process.env.SCOUT_FRESH_HOURS ?? '24');

export const scout: Agent = {
  name: 'scout',
  everyMin: 240,
  quietHoursTrt: [1, 7],
  onOverBudget: 'skip',
  async run(db) {
    const nowIso = new Date().toISOString();
    const [{ data: open }, { data: newest }] = await Promise.all([
      db.from('markets').select('category').eq('status', 'active').gt('ends_at', nowIso),
      db.from('markets').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const active = open?.length ?? 0;

    if (active < TARGET) {
      const topUp = await topUpMarkets(db, TARGET);
      return { mode: 'top_up', active, target: TARGET, ...topUp };
    }

    const hoursSinceNew = newest ? (Date.now() - new Date(newest.created_at).getTime()) / 36e5 : Infinity;
    if (hoursSinceNew < FRESH_HOURS || active >= MAX_ACTIVE) {
      return { mode: 'idle', active, hoursSinceNew: Math.round(hoursSinceNew) };
    }

    const counts = new Map<string, number>(CATEGORIES.map((c) => [c, 0]));
    for (const m of open ?? []) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
    const category = [...CATEGORIES].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0] as MarketCategory;
    const region: MarketRegion = category === 'world' ? 'global' : Math.random() < 0.7 ? 'turkey' : 'global';
    const res = await generateMarkets(db, { category, region, count: 2 });
    return {
      mode: 'fresh',
      active,
      hoursSinceNew: Math.round(hoursSinceNew),
      category,
      inserted: res.inserted.map((m) => m.title_tr),
      rejected: res.rejected.length,
    };
  },
};
